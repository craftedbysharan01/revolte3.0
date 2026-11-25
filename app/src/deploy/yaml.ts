export const YAML = `name: webhook-monitor
runtime: node20
services:
  web:
    port: 8080
    cpu: 2
    memory: 4096
    replicas: 2
    healthcheck: /api/health
  database:
    engine: postgres
    version: 16
    storage: 30Gi
pre_build:
  - test
  - code_quality
  - sast
deploy:
  branch: revolte/webhook-dashboard
  target: production
env:
  - REDIS_CLUSTER_PASSWORD=\${{ secrets.REDIS_CLUSTER_PASSWORD }}
  - DB_ENCRYPTION_KEY=\${{ secrets.DB_ENCRYPTION_KEY }}
  - PAGERDUTY_ROUTING_KEY=\${{ secrets.PAGERDUTY_ROUTING_KEY }}`
