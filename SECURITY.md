# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs.

Email: **thomas@onecode.dk**

Include:
- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept.
- Your name / handle if you'd like to be credited.

I aim to acknowledge reports within 72 hours and to ship a fix or mitigation as quickly as the severity warrants.

## Scope

In scope:
- The dashboard (Next.js app under `dashboard/`)
- The Postgres init scripts and role grants (`postgres/`)
- The Caddy configuration (`caddy/`)
- The `docker-compose.yml` / `docker-compose.prod.yml` topology

Out of scope:
- Misconfigurations in your own `.env` (e.g., weak `SESSION_SECRET`) — those are deployment issues, not code bugs.
- Vulnerabilities in upstream dependencies (Postgres, PostgREST, MinIO, Caddy, Next.js, `pg`, `iron-session`, `@node-rs/argon2`). Please report those to the respective projects; I'll pick up the patch when it lands.

## Secrets and this repository

This repository is public. **No real secrets should ever land here.** `.env` is gitignored; only `.env.example` (placeholders) is committed. GitHub secret scanning + push protection are enabled to refuse pushes that contain recognizable secret patterns.

If you spot a value in the tree that looks like it shouldn't be there, treat it as a security report.
