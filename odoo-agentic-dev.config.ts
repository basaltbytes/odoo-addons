import {defineConfig} from "@basaltbytes/odoo-agentic-dev";

export default defineConfig({
  project: {
    id: "basaltbytes-odoo-addons",
    dbPrefix: "bbaddons",
  },

  odoo: {
    // Pin the multi-architecture image index. Advance the mutable 19.0 tag
    // deliberately so local and CI runs use the same Odoo nightly on amd64 and
    // arm64 hosts.
    version:
      "19.0@sha256:f54272f31d5f77e4146b887efb3761c98480317daf687e4b4b5e76ed8bcc08c5",
    // The Hoot browser suites run headless Chrome inside the container. The
    // odoo:19 image is Ubuntu 24.04 (apt chromium is a snap stub), so install
    // playwright's chromium and expose it as `chromium` on PATH, where Odoo's
    // browser test base looks for it.
    build: {
      // Websocket-client: without it Odoo's browser test base SKIPS the Hoot
      // suites instead of failing them. unittest-xml-reporting: JUnit XML
      // reports through odoo_test_xmlrunner.
      pipPackages: ["playwright", "websocket-client", "unittest-xml-reporting"],
      run: [
        "PLAYWRIGHT_BROWSERS_PATH=/opt/playwright python3 -m playwright install --with-deps chromium",
        'set -eu; chmod -R a+rX /opt/playwright; bin=$(find /opt/playwright -type f -name chrome -path \'*chrome-linux*\' | head -n1); test -n "$bin"; ln -sf "$bin" /usr/local/bin/chromium; chromium --version',
      ],
    },
    postgresImage: "postgres:18.6",
    // Addons live directly under addons/; Odoo discovers manifests one level
    // below the mounted path.
    addons: [{host: "addons", container: "/mnt/extra-addons/basaltbytes"}],
  },

  database: {
    initialModules: [
      "odoo_test_xmlrunner",
      "web_module_test_harness",
      "web_field_change_confirm",
    ],
    withoutDemo: "all",
  },

  test: {
    profiles: {
      // Every authored addon's full suite, Python and Hoot.
      runtime: [
        "--test-tags",
        "/odoo_test_xmlrunner,/web_module_test_harness,/web_field_change_confirm",
      ],
      // Browser-driven Hoot suites only (headless Chrome via web_module_test_harness).
      hoot: ["--test-tags", "/web_field_change_confirm:TestWebFieldChangeConfirmHoot"],
    },
  },

  setup: {
    packageManagers: [{cwd: ".", command: "pnpm", args: ["install"]}],
  },
});
