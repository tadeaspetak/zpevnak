#!/usr/bin/env bash
# Builds the current commit on Cloud Build and deploys it to Cloud Run:
#   yarn deploy
# Runs under the repo's own gcloud configuration, never the machine's default.
set -euo pipefail
export CLOUDSDK_ACTIVE_CONFIG_NAME=zpevnak

PROJECT=zpevnak
REGION=europe-west4 # Cloud Run custom domains aren't offered in europe-west3
SERVICE=zpevnak
URL=https://zpevnak.tadeaspetak.com

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit first: a deploy is always one commit, so it can be found again." >&2
  exit 1
fi
SHA=$(git rev-parse --short HEAD)
IMAGE="$REGION-docker.pkg.dev/$PROJECT/zpevnak/app:$SHA"

if ! gcloud artifacts docker images describe "$IMAGE" >/dev/null 2>&1; then
  gcloud builds submit --region="$REGION" --tag "$IMAGE" .
fi

# At most 2 instances: the hard cap on what this can cost (the budget only warns).
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "zpevnak-run@$PROJECT.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 \
  --memory 512Mi \
  --cpu-boost \
  --set-secrets "DATABASE_URL=database-url:latest,RESEND_API_KEY=resend-api-key:latest" \
  --set-env-vars "^|^APP_URL=$URL|EMAIL_FROM=Zpěvňák <noreply@zpevnak.tadeaspetak.com>"

echo "Deployed $SHA. $URL"
