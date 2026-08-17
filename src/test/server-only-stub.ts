/**
 * Stand-in for the `server-only` package under test.
 *
 * The real module throws on import to stop server code being pulled into a
 * client bundle. That guard is a build-time concern; in unit tests we import
 * those modules on purpose, so this resolves to nothing.
 */
export {};
