# Vercel project region alignment

On 21 September 2026, the existing `magickly` Vercel project default was
aligned with its deployed London functions and the repository's
`vercel.json`. The authenticated request used Vercel's documented
`PATCH /v9/projects/{idOrName}` endpoint with this complete body:

```json
{
  "resourceConfig": {
    "functionDefaultRegions": ["lhr1"]
  }
}
```

The project readback changed from `cdg1` to `lhr1`. Vercel also refreshed the
equivalent `defaultResourceConfig.functionDefaultRegions` and
`serverlessFunctionRegion` views plus the project update timestamp. A full
before/after object comparison found no other changed paths. The existing
Production deployment `dpl_7Kro5hguKkrNtYik77dqWH2izP5E` remained in `lhr1`;
this settings update did not create or promote a deployment.

This records only the provider alignment performed on that date. It does not
assert that future deployments or later project settings remain unchanged.
