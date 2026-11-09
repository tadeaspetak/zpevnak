import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The deterministic half of a UX walk: what a page measures as, with no taste
 * involved. `ux` reads these beside its own look at the screen, and a
 * human can run the same measurement with `yarn ux:probe` (see `probe.ts`). Ported from deedmob.
 *
 * Every probe runs against whatever the page shows at the moment it is called,
 * so a caller that opens a menu or a dialog first probes that state. With a
 * modal dialog open, the probes measure the dialog only: the page behind its
 * backdrop is neither readable nor reachable, and measuring it reports every
 * one of its controls as unreachable and every one of its colours as faded.
 * That page gets its own probe, with the dialog closed.
 */

/** A short, human-readable handle for an element: tag, test id or id, and its text. */
type ElementRef = {
  selector: string;
  name: string;
};

export type AxeViolation = {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  targets: string[];
};

export type OverflowFinding = ElementRef & {
  /**
   * `beyond-viewport` is measured from where the element sits, not from scroll
   * sizes: content pushed past either edge of the screen when nothing scrolls,
   * which `scrollWidth` never shows (leftward overflow, or an ancestor that
   * clips). For it, `scrollWidth` is the element's width, `clientWidth` the
   * viewport's, and `left`/`right` where it sits.
   */
  kind:
    'page-scrolls-sideways' | 'content-overflows' | 'text-truncated' | 'beyond-viewport';
  scrollWidth: number;
  clientWidth: number;
  left?: number;
  right?: number;
};

/** An icon set flush against the text it labels (in a badge, chip, button or row). */
export type IconSpacingFinding = ElementRef & {
  /** Pixels between the icon and the nearest character on its line. */
  gap: number;
};

/**
 * A menu, list box, tooltip or popover carrying more reading than choosing:
 * explanation run into the options instead of set apart from them.
 */
export type DenseOverlayFinding = ElementRef & {
  role: string;
  words: number;
  /** Words in the wordiest option: an option that explains itself at length. */
  longestOptionWords: number;
};

export type TapTargetFinding = ElementRef & {
  width: number;
  height: number;
  /**
   * `below-24` fails WCAG 2.2 AA (2.5.8): under 24 × 24 and crowded by a neighbour.
   * `below-44` only misses the comfortable size (2.5.5, AAA), spacing included.
   */
  level: 'below-24' | 'below-44';
};

/** A focus ring cut off by an ancestor that clips (`overflow` other than `visible`). */
type ClippedRingFinding = ElementRef & {
  /** The clipping ancestor. */
  clippedBy: string;
  /** Pixels of ring hidden, per side that loses any. */
  sides: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
};

export type FocusReport = {
  order: ElementRef[];
  /**
   * Stops whose focus ring an ancestor cuts off: a full-width button in a
   * scrolling dialog body that has no inner padding loses its ring's sides.
   */
  clippedRings: ClippedRingFinding[];
  /** Visible, enabled controls that Tab never reached. */
  unreachable: ElementRef[];
  /** With a modal dialog open: where Tab took focus out of it, if it did. */
  escapedTo: ElementRef | null;
};

export type ProbeResult = {
  /** The modal dialog the probes measured, or `null` for the whole page. */
  scope: ElementRef | null;
  axe: AxeViolation[];
  overflow: OverflowFinding[];
  tapTargets: TapTargetFinding[];
  iconSpacing: IconSpacingFinding[];
  denseOverlays: DenseOverlayFinding[];
  /** `null` when a menu or popover is open: the first Tab would close it, not move. */
  focus: FocusReport | null;
  layoutShift: number;
};

/** Only these reach the report: moderate and minor axe results are mostly noise at walk level. */
const REPORTED_AXE_IMPACTS = new Set(['serious', 'critical']);

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Enough for any page on the platform; a page with more stops is itself a finding. */
const MAX_TAB_STOPS = 150;

/**
 * The marker on the open modal dialog, set by the in-page `scope()` helper so
 * that axe, which takes selectors rather than elements, can be pointed at it.
 */
const SCOPE_ATTRIBUTE = 'data-ux-walk-scope';

/**
 * Below this an icon reads as glued to its text. Calibrated on the owner's
 * review of the rich profile (2026-10-13): the provenance badges' icons sat
 * 0 px from their labels, while the navbar's "More" chevron at 2.8 px reads fine.
 */
const MIN_ICON_GAP = 2;

/** A few clipped pixels (an icon's antialiased edge in its wrapper) are not visible. */
const MAX_INVISIBLE_CLIP = 4;

/** Open overlays that take keyboard focus: tabbing with one open closes it instead. */
const FOCUS_TAKING_OVERLAYS =
  '[role="menu"], [role="listbox"], [class*="Popover-dropdown"]';

/** Icon-sized: a larger image beside text is a picture, not a label's icon. */
const MAX_ICON_SIZE = 32;

/**
 * The same review's visibility menu ran to about 60 words, its options to 25:
 * a paragraph per option and one under them. A menu is for choosing; past
 * these, the explanation wants its own block, apart from the options.
 */
const MAX_OVERLAY_WORDS = 40;
const MAX_OPTION_WORDS = 15;

export const probeAxe = async (page: Page): Promise<AxeViolation[]> => {
  await installHelpers(page);
  const scoped = await page.evaluate(
    () =>
      (window as unknown as { __uxWalk: InPageHelpers }).__uxWalk.scope() !==
      document.body,
  );
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const { violations } = await (
    scoped ? builder.include(`[${SCOPE_ATTRIBUTE}]`) : builder
  ).analyze();

  return violations
    .filter((violation) => REPORTED_AXE_IMPACTS.has(violation.impact ?? ''))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? '',
      help: violation.help,
      helpUrl: violation.helpUrl,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
};

/**
 * The in-page helpers every DOM probe needs. Installed once per document as
 * `window.__uxWalk`, because `page.evaluate` serialises each function on its own
 * and cannot share a closure between calls.
 */
const installHelpers = (page: Page) =>
  page.evaluate((scopeAttribute) => {
    const INTERACTIVE = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="combobox"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    // A map pans in two dimensions inside its own box, so its tiles and markers past
    // that box are not content lost to a narrow screen: WCAG 1.4.10 exempts maps, as
    // it does a data table scrolling in its own container. The map's own box still
    // counts. Google Maps renders `.gm-style`, Leaflet `.leaflet-container`.
    const MAP = '.gm-style, .leaflet-container';

    // Screen-reader-only content (skip links, visually hidden labels) and a native file
    // input parked behind its styled button are clipped to a few pixels on purpose;
    // measuring them as a tiny control or an overflow is noise. A box that small which
    // clips is hiding what is in it when it is also taken out of the flow or made
    // invisible; a visible one is a control squeezed too small, and still counts.
    const isVisuallyHidden = (element: Element) =>
      [element, ...ancestors(element)].some((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        return (
          (style.clip !== 'auto' && style.clip !== '') ||
          style.clipPath.startsWith('inset(50%') ||
          ((style.position === 'absolute' || style.opacity === '0') &&
            style.overflow === 'hidden' &&
            rect.width <= 8 &&
            rect.height <= 8)
        );
      });

    function ancestors(element: Element) {
      const list: Element[] = [];
      for (
        let node = element.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        list.push(node);
      }

      return list;
    }

    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }
      const style = getComputedStyle(element);

      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        !isVisuallyHidden(element)
      );
    };

    const describe = (element: Element) => {
      const testId = element.getAttribute('data-testid');
      const id = element.id;
      const tag = element.tagName.toLowerCase();
      const selector = testId ? `[data-testid="${testId}"]` : id ? `${tag}#${id}` : tag;
      const label =
        element.getAttribute('aria-label') ??
        element.getAttribute('title') ??
        (element as HTMLElement).innerText ??
        element.getAttribute('placeholder') ??
        '';

      return { selector, name: label.replace(/\s+/g, ' ').trim().slice(0, 80) };
    };

    const isDisabled = (element: Element) =>
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true';

    // The topmost open modal dialog, else the body. Stacked dialogs portal in opening
    // order, so the last visible one is the one on top.
    const scope = () => {
      document
        .querySelectorAll(`[${scopeAttribute}]`)
        .forEach((element) => element.removeAttribute(scopeAttribute));
      // Mantine marks its modals `aria-modal`; `_ui/Dialog` (react-aria's `useModal`) marks
      // nothing, so a dialog is also modal when it looks modal: it fills the screen, or what
      // sits on top in the corner is a fixed full-screen layer (its backdrop, which often
      // wraps the dialog) that is not the page itself.
      const coversScreen = (rect: DOMRect) =>
        rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9;
      const pageContent = document.querySelector('main, [role="main"], #content');
      const looksModal = (dialog: Element) => {
        if (coversScreen(dialog.getBoundingClientRect())) {
          return true;
        }
        for (
          let node = document.elementFromPoint(1, 1);
          node && node !== document.body;
          node = node.parentElement
        ) {
          if (
            getComputedStyle(node).position === 'fixed' &&
            coversScreen(node.getBoundingClientRect()) &&
            !(pageContent && node.contains(pageContent))
          ) {
            return true;
          }
        }

        return false;
      };
      const modal = Array.from(
        document.querySelectorAll(
          '[aria-modal="true"], dialog[open], [role="dialog"], [role="alertdialog"]',
        ),
      )
        .filter(
          (dialog) =>
            isVisible(dialog) &&
            (dialog.getAttribute('aria-modal') === 'true' ||
              dialog.tagName === 'DIALOG' ||
              looksModal(dialog)),
        )
        .at(-1);
      modal?.setAttribute(scopeAttribute, '');

      return modal ?? document.body;
    };

    // How far the focused element's ring reaches past its border box: the outline
    // (width + offset), else the largest box-shadow spread + blur, the two ways
    // Mantine and our CSS draw it.
    const ringExtent = (element: Element) => {
      const style = getComputedStyle(element);
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
        return parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset || '0');
      }
      if (style.boxShadow === 'none') {
        return 0;
      }

      return Math.max(
        0,
        ...style.boxShadow
          .split(/,(?![^(]*\))/)
          .filter((shadow) => !shadow.includes('inset'))
          .map((shadow) => {
            const lengths = (shadow.match(/-?[\d.]+px/g) ?? []).map(parseFloat);

            return (lengths[2] ?? 0) + (lengths[3] ?? 0);
          }),
      );
    };

    const ringClip = (element: Element) => {
      const extent = ringExtent(element);
      if (extent <= 0) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      for (const node of ancestors(element)) {
        const style = getComputedStyle(node);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') {
          continue;
        }
        const box = node.getBoundingClientRect();
        const left = box.left + node.clientLeft;
        const top = box.top + node.clientTop;
        const right = left + node.clientWidth;
        const bottom = top + node.clientHeight;
        // Scrolled out of view is a different problem; only a ring around a control
        // that is itself inside the box counts.
        if (
          rect.left < left ||
          rect.right > right ||
          rect.top < top ||
          rect.bottom > bottom
        ) {
          continue;
        }
        const sides: Record<string, number> = {};
        const lost = {
          left: left - (rect.left - extent),
          right: rect.right + extent - right,
          top: top - (rect.top - extent),
          bottom: rect.bottom + extent - bottom,
        };
        for (const [side, px] of Object.entries(lost)) {
          if (px >= 1) {
            sides[side] = Math.round(px * 10) / 10;
          }
        }
        if (Object.keys(sides).length > 0) {
          const { selector } = describe(node);
          // A bare `div` names nothing; its CSS-module class says which component it is.
          const className = node.classList[0];

          return {
            clippedBy: selector === 'div' && className ? `div.${className}` : selector,
            sides,
          };
        }
      }

      return null;
    };

    (window as unknown as { __uxWalk: unknown }).__uxWalk = {
      INTERACTIVE,
      MAP,
      isVisible,
      describe,
      isDisabled,
      scope,
      ringClip,
    };
  }, SCOPE_ATTRIBUTE);

type InPageHelpers = {
  INTERACTIVE: string;
  MAP: string;
  isVisible: (element: Element) => boolean;
  describe: (element: Element) => ElementRef;
  isDisabled: (element: Element) => boolean;
  scope: () => Element;
  ringClip: (element: Element) => Omit<ClippedRingFinding, keyof ElementRef> | null;
};

/** The modal dialog the probes will measure, or `null` when they measure the page. */
const probeScope = async (page: Page): Promise<ElementRef | null> => {
  await installHelpers(page);

  return page.evaluate(() => {
    const { scope, describe } = (window as unknown as { __uxWalk: InPageHelpers })
      .__uxWalk;
    const root = scope();

    return root === document.body ? null : describe(root);
  });
};

export const probeOverflow = async (page: Page): Promise<OverflowFinding[]> => {
  await installHelpers(page);

  return page.evaluate((maxInvisibleClip) => {
    const { MAP, isVisible, describe, scope } = (
      window as unknown as { __uxWalk: InPageHelpers }
    ).__uxWalk;
    const findings: OverflowFinding[] = [];
    const root = scope();
    const elements = Array.from(root.querySelectorAll('*')).filter(
      (element) => isVisible(element) && !element.parentElement?.closest(MAP),
    );

    // The page's own sideways scroll is the page's finding, not an open dialog's.
    if (
      root === document.body &&
      document.documentElement.scrollWidth > window.innerWidth + 1
    ) {
      findings.push({
        kind: 'page-scrolls-sideways',
        selector: 'html',
        name: '',
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: window.innerWidth,
      });
    }

    const scrollsSideways = (element: Element) =>
      ['auto', 'scroll'].includes(getComputedStyle(element).overflowX);
    // A decoration hidden from assistive technology, with no text of its own (an organisation
    // cover's blurred backdrop, scaled past its frame so the blur's faded edge is cut off), is
    // meant to be cut off by the box that clips it: nothing anyone needs is lost. Anything with
    // text, or not `aria-hidden`, still counts, and so does a page it makes scroll.
    // The `aria-hidden` must sit inside that box. react-aria hides the whole app root while a
    // `_ui/Popover` or `_ui/Dialog` is open, and that says nothing about what a box inside it
    // cuts off.
    const isDecorationClippedBy = (element: Element, box: Element) => {
      const hidden = element.closest('[aria-hidden="true"]');

      return (
        hidden !== null && box.contains(hidden) && !(element.textContent ?? '').trim()
      );
    };
    const pastBox = (rect: DOMRect, box: DOMRect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      (rect.left < box.left - 1 || rect.right > box.right + 1);
    // Only decorations stick out of this box: no element and no text that is not one.
    const overflowsOnlyWithDecoration = (element: Element) => {
      const box = element.getBoundingClientRect();
      let decorated = false;
      const walker = document.createTreeWalker(
        element,
        // Distinct bits, so the sum is the two filters together.
        NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT,
      );
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node instanceof Element) {
          if (!pastBox(node.getBoundingClientRect(), box)) {
            continue;
          }
          if (!isDecorationClippedBy(node, element)) {
            return false;
          }
          decorated = true;
        } else if (node.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          if (pastBox(range.getBoundingClientRect(), box)) {
            return false;
          }
        }
      }

      return decorated;
    };
    const beyondViewport = new Set(
      elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        const pastAnEdge = rect.left < -1 || rect.right > window.innerWidth + 1;
        // Entirely off screen is a closed drawer or an inactive slide, parked on purpose.
        const onScreen = rect.right > 0 && rect.left < window.innerWidth;
        let inScroller = false;
        // The nearest box that clips it. Not `body`: the app gives it `overflow-x: hidden`, so
        // it would excuse anything past the screen's edge.
        let clipper: Element | null = null;
        for (
          let node = element.parentElement;
          node && !inScroller;
          node = node.parentElement
        ) {
          inScroller = scrollsSideways(node);
          if (
            !clipper &&
            node !== document.body &&
            node !== document.documentElement &&
            getComputedStyle(node).overflowX !== 'visible'
          ) {
            clipper = node;
          }
        }

        return (
          pastAnEdge &&
          onScreen &&
          !inScroller &&
          !(clipper && isDecorationClippedBy(element, clipper))
        );
      }),
    );
    // Only the outermost: its descendants stick out because it does.
    for (const element of beyondViewport) {
      let ancestor = element.parentElement;
      while (ancestor && !beyondViewport.has(ancestor)) {
        ancestor = ancestor.parentElement;
      }
      if (ancestor) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      findings.push({
        kind: 'beyond-viewport',
        ...describe(element),
        scrollWidth: Math.round(rect.width),
        clientWidth: window.innerWidth,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }

    for (const element of elements) {
      if (beyondViewport.has(element)) {
        continue;
      }
      if (element.scrollWidth <= element.clientWidth + 1) {
        continue;
      }
      const style = getComputedStyle(element);
      // A container that scrolls on purpose (a table wrapper, a carousel), a map panning
      // inside its own box, or a field scrolling its own value (a long link to copy) is
      // not a defect.
      const isExempt = (node: Element) =>
        scrollsSideways(node) || node.matches(`${MAP}, input, textarea`);
      if (isExempt(element)) {
        continue;
      }
      const truncated =
        style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
      // A truncation with a tooltip carrying the full text is a design choice, not a loss.
      if (truncated && element.hasAttribute('title')) {
        continue;
      }
      // Only the innermost overflowing element: its ancestors overflow because of it.
      // An exempt child (a field scrolling its value, a map) overflows its own box on
      // purpose, so it does not stand in for this element's clipping.
      const child = Array.from(element.children).find(
        (candidate) =>
          candidate.scrollWidth > candidate.clientWidth + 1 && !isExempt(candidate),
      );
      if (child && !truncated) {
        continue;
      }
      // `overflow: visible` content wider than its box only matters when it is clipped.
      if (!truncated && style.overflowX === 'visible') {
        continue;
      }
      if (!truncated && element.scrollWidth - element.clientWidth <= maxInvisibleClip) {
        continue;
      }
      if (!truncated && overflowsOnlyWithDecoration(element)) {
        continue;
      }
      findings.push({
        kind: truncated ? 'text-truncated' : 'content-overflows',
        ...describe(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      });
    }

    return findings;
  }, MAX_INVISIBLE_CLIP);
};

export const probeTapTargets = async (page: Page): Promise<TapTargetFinding[]> => {
  await installHelpers(page);

  return page.evaluate(() => {
    const { INTERACTIVE, isVisible, describe, isDisabled, scope } = (
      window as unknown as { __uxWalk: InPageHelpers }
    ).__uxWalk;
    const findings: TapTargetFinding[] = [];
    const targets = Array.from(scope().querySelectorAll(INTERACTIVE)).filter(
      (element) => isVisible(element) && !isDisabled(element),
    );
    const rects = targets.map((element) => element.getBoundingClientRect());

    // WCAG 2.5.8's spacing exception: an undersized target passes AA when a 24px square
    // centred on it overlaps no other target, i.e. it is small but cannot be mis-hit.
    const isSpacedApart = (index: number) => {
      const rect = rects[index] as DOMRect;
      const self = targets[index] as Element;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      return rects.every(
        (other, otherIndex) =>
          otherIndex === index ||
          (targets[otherIndex] as Element).contains(self) ||
          self.contains(targets[otherIndex] as Element) ||
          other.right <= cx - 12 ||
          other.left >= cx + 12 ||
          other.bottom <= cy - 12 ||
          other.top >= cy + 12,
      );
    };

    for (const [index, element] of targets.entries()) {
      // A link inside a sentence is exempt from target size (WCAG 2.5.8's inline exception).
      const style = getComputedStyle(element);
      const parentText = element.parentElement?.textContent ?? '';
      const ownText = element.textContent ?? '';
      if (
        style.display === 'inline' &&
        parentText.trim().length > ownText.trim().length
      ) {
        continue;
      }
      // A native checkbox or radio is usually covered by its label; measure the label instead.
      const label =
        element instanceof HTMLInputElement &&
        ['checkbox', 'radio'].includes(element.type)
          ? element.closest('label')
          : null;
      const rect = (label ?? element).getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44) {
        continue;
      }
      findings.push({
        ...describe(element),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        level:
          (rect.width < 24 || rect.height < 24) && !isSpacedApart(index)
            ? 'below-24'
            : 'below-44',
      });
    }

    return findings;
  });
};

/**
 * Every icon-sized `svg` or `img` measured against the nearest character of
 * the text it sits beside, on the same line. A pure geometry check: the eye
 * catches a glued icon at 2× long before any rule does.
 */
export const probeIconSpacing = async (page: Page): Promise<IconSpacingFinding[]> => {
  await installHelpers(page);

  return page.evaluate(
    ({ minGap, maxIconSize }) => {
      const { INTERACTIVE, isVisible, describe, scope } = (
        window as unknown as { __uxWalk: InPageHelpers }
      ).__uxWalk;
      const findings: IconSpacingFinding[] = [];
      const icons = Array.from(scope().querySelectorAll('svg, img')).filter((icon) => {
        const rect = icon.getBoundingClientRect();

        return isVisible(icon) && rect.width <= maxIconSize && rect.height <= maxIconSize;
      });

      // The rect of one character of a text node, so spaces count as part of the gap.
      const charRect = (node: Text, offset: number) => {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);

        return range.getBoundingClientRect();
      };

      for (const icon of icons) {
        // An icon-only control (⋯, ×) labels itself; text near it is a neighbour, not its label.
        const control = icon.closest(INTERACTIVE);
        if (control && !(control as HTMLElement).innerText?.trim()) {
          continue;
        }
        // The label lives beside the icon, in a sibling or the parent's text, not
        // further out: past three levels the "neighbour" is another element entirely.
        let container = icon.parentElement;
        for (
          let depth = 0;
          container && depth < 3 && !(container as HTMLElement).innerText?.trim();
          depth += 1
        ) {
          container = container.parentElement;
        }
        if (!container) {
          continue;
        }
        const iconRect = icon.getBoundingClientRect();
        const iconRange = document.createRange();
        iconRange.selectNode(icon);
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const gaps: number[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node as Text;
          const parent = text.parentElement;
          if (!text.data.trim() || !parent || icon.contains(text) || !isVisible(parent)) {
            continue;
          }
          const after = iconRange.comparePoint(text, 0) === 1;
          const rect = after
            ? charRect(text, text.data.search(/\S/))
            : charRect(text, text.data.trimEnd().length - 1);
          const sameLine = rect.top < iconRect.bottom && rect.bottom > iconRect.top;
          if (sameLine) {
            gaps.push(after ? rect.left - iconRect.right : iconRect.left - rect.right);
          }
        }
        const nearest = gaps.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
        // An overlap is a count bubble on its icon, placed there on purpose.
        if (nearest !== undefined && nearest > -1 && nearest < minGap) {
          findings.push({ ...describe(container), gap: Math.round(nearest * 10) / 10 });
        }
      }

      return findings;
    },
    { minGap: MIN_ICON_GAP, maxIconSize: MAX_ICON_SIZE },
  );
};

/**
 * Open menus, list boxes, tooltips and popovers, wherever they are portaled:
 * they open over a dialog as often as over the page, so this probe ignores the
 * modal scope.
 */
export const probeDenseOverlays = async (page: Page): Promise<DenseOverlayFinding[]> => {
  await installHelpers(page);

  return page.evaluate(
    ({ maxWords, maxOptionWords }) => {
      const { isVisible, describe, scope } = (
        window as unknown as { __uxWalk: InPageHelpers }
      ).__uxWalk;
      const wordCount = (element: Element) =>
        ((element as HTMLElement).innerText ?? '').split(/\s+/).filter(Boolean).length;
      // A modal dialog is a page of its own, not an overlay to choose from.
      const modal = scope();
      const overlays = Array.from(
        document.querySelectorAll(
          '[role="menu"], [role="listbox"], [role="tooltip"], [role="dialog"], [class*="Popover-dropdown"]',
        ),
      ).filter((overlay) => overlay !== modal && isVisible(overlay));

      return (
        overlays
          // A menu inside a popover is one overlay; measure the outer one.
          .filter(
            (overlay) =>
              !overlays.some((other) => other !== overlay && other.contains(overlay)),
          )
          .map((overlay) => ({
            ...describe(overlay),
            role: overlay.getAttribute('role') ?? 'popover',
            words: wordCount(overlay),
            longestOptionWords: Math.max(
              0,
              ...Array.from(
                overlay.querySelectorAll(
                  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]',
                ),
              ).map(wordCount),
            ),
          }))
          .filter(
            (finding) =>
              finding.words > maxWords || finding.longestOptionWords > maxOptionWords,
          )
      );
    },
    { maxWords: MAX_OVERLAY_WORDS, maxOptionWords: MAX_OPTION_WORDS },
  );
};

/**
 * Tabs through the page from the top and records each stop, until focus comes
 * back round, leaves the document, or {@link MAX_TAB_STOPS} is reached. With a
 * modal dialog open it starts inside the dialog, and stops where focus leaves it.
 */
export const probeFocusOrder = async (page: Page): Promise<FocusReport> => {
  await installHelpers(page);
  // In a dialog, focus starts on its first control, which then counts as the first stop.
  const start = await page.evaluate(() => {
    const { scope, INTERACTIVE, isVisible, isDisabled, describe, ringClip } = (
      window as unknown as { __uxWalk: InPageHelpers }
    ).__uxWalk;
    const root = scope();
    if (root === document.body) {
      // Chrome tabs on from the last focused element even after a blur (a `?focus=`
      // link, a closed dialog), so start from a marker at the top of the page.
      const marker = document.createElement('span');
      marker.tabIndex = -1;
      marker.setAttribute('data-ux-walk-start', '');
      document.body.prepend(marker);
      marker.focus();
      window.scrollTo(0, 0);

      return null;
    }
    if (!root.contains(document.activeElement) || document.activeElement === root) {
      const first = Array.from(root.querySelectorAll(INTERACTIVE)).find(
        (element) => isVisible(element) && !isDisabled(element),
      );
      (first as HTMLElement | undefined)?.focus();
    }
    const active = document.activeElement;
    if (!active || active === root || !root.contains(active)) {
      return null;
    }
    active.setAttribute('data-ux-walk-stop', '0');

    return { ref: describe(active), clip: ringClip(active) };
  });

  const order: ElementRef[] = start ? [start.ref] : [];
  const clippedRings: ClippedRingFinding[] = start?.clip
    ? [{ ...start.ref, ...start.clip }]
    : [];
  const visited: string[] = start ? ['0'] : [];
  let escapedTo: ElementRef | null = null;

  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate((scopeAttribute) => {
      const { describe, ringClip } = (window as unknown as { __uxWalk: InPageHelpers })
        .__uxWalk;
      const active = document.activeElement;
      if (!active || active === document.body) {
        return null;
      }
      const root = document.querySelector(`[${scopeAttribute}]`);
      if (root && !root.contains(active)) {
        return {
          key: '',
          ref: describe(active),
          escaped: true,
          inFrame: false,
          clip: null,
        };
      }
      if (!active.hasAttribute('data-ux-walk-stop')) {
        active.setAttribute(
          'data-ux-walk-stop',
          String(document.querySelectorAll('[data-ux-walk-stop]').length),
        );
      }

      return {
        key: active.getAttribute('data-ux-walk-stop') ?? '',
        ref: describe(active),
        escaped: false,
        inFrame: active.tagName === 'IFRAME',
        clip: ringClip(active),
      };
    }, SCOPE_ATTRIBUTE);
    if (current?.escaped) {
      escapedTo = current.ref;
      break;
    }
    // Tab moves between the stops inside an embedded frame (a map) while the page
    // still sees the frame as focused: that is progress, not focus coming round.
    if (current?.inFrame && visited.includes(current.key)) {
      continue;
    }
    if (!current || visited.includes(current.key)) {
      break;
    }
    visited.push(current.key);
    order.push(current.ref);
    if (current.clip) {
      clippedRings.push({ ...current.ref, ...current.clip });
    }
  }

  const unreachable = await page.evaluate(() => {
    const { INTERACTIVE, isVisible, describe, isDisabled, scope } = (
      window as unknown as { __uxWalk: InPageHelpers }
    ).__uxWalk;
    const missed = Array.from(scope().querySelectorAll(INTERACTIVE)).filter(
      (element) =>
        isVisible(element) &&
        !isDisabled(element) &&
        !element.hasAttribute('data-ux-walk-stop') &&
        // A control containing the focused stop (a label around its input) was reached.
        !element.querySelector('[data-ux-walk-stop]') &&
        // Out of both the tab order and the accessibility tree on purpose: a card's
        // image repeating the link its title carries. A control that is only
        // `tabindex="-1"` still counts, as nothing else may offer it.
        !(
          element.getAttribute('tabindex') === '-1' &&
          element.closest('[aria-hidden="true"]')
        ) &&
        // Composite widgets (radio groups, tab lists, menus) expose one stop on purpose.
        !element.closest(
          '[role="radiogroup"],[role="tablist"],[role="menu"],[role="listbox"]',
        ),
    );
    document
      .querySelectorAll('[data-ux-walk-stop]')
      .forEach((element) => element.removeAttribute('data-ux-walk-stop'));
    document.querySelector('[data-ux-walk-start]')?.remove();

    return missed.map(describe);
  });

  return { order, clippedRings, unreachable, escapedTo };
};

/** Cumulative layout shift since navigation, from the buffered performance entries. */
const probeLayoutShift = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) {
              total += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        // Buffered entries are delivered asynchronously; one frame is enough to collect them.
        requestAnimationFrame(() => {
          observer.disconnect();
          resolve(Math.round(total * 1000) / 1000);
        });
      }),
  );

/** Focus order last: tabbing moves focus and can open things the other probes should not see. */
export const runProbes = async (page: Page): Promise<ProbeResult> => {
  const scope = await probeScope(page);
  const axe = await probeAxe(page);
  const overflow = await probeOverflow(page);
  const tapTargets = await probeTapTargets(page);
  const iconSpacing = await probeIconSpacing(page);
  const denseOverlays = await probeDenseOverlays(page);
  const layoutShift = await probeLayoutShift(page);
  const overlayOpen = await page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll(selector)).some(
        (element) => element.getBoundingClientRect().width > 0,
      ),
    FOCUS_TAKING_OVERLAYS,
  );
  const focus = overlayOpen ? null : await probeFocusOrder(page);

  return {
    scope,
    axe,
    overflow,
    tapTargets,
    iconSpacing,
    denseOverlays,
    focus,
    layoutShift,
  };
};
