/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@poolr/eslint-config"],
  ignorePatterns: ["apps/**", "packages/**", "tooling/**"],
};
