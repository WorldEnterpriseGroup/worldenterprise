/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** "1" on GitLab Pages preview builds: robots noindex, canonicals still point at production. */
  readonly PUBLIC_PREVIEW?: string;
  /** "1" on release builds: every launch:true route must exist and no draft content may remain. */
  readonly PUBLIC_RELEASE?: string;
  /** "1" to build the internal /styleguide/ route. */
  readonly PUBLIC_STYLEGUIDE?: string;
  /** Intake endpoint for the Apply and Contact forms (see docs/forms-contract.md). */
  readonly PUBLIC_WE_INTAKE_API_URL?: string;
  /** Newsletter signup endpoint. Hidden when unset. */
  readonly PUBLIC_WE_NEWSLETTER_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
