- The page loads the test helpers of `web` only. If the tests import helpers from
  another addon, such as `mail`, add these files to the addon's
  `<module_name>.assets_unit_tests` bundle.
- The page replaces the `worker_service` of the bus with a stub that doesn't open a
  WebSocket, so tests can't use a real bus connection.
- Hoot sometimes fails to load the first test file and finds 0 tests. For this reason
  `ModuleHootCase` runs the tests again after a failure, `hoot_retries` times. A real
  failure fails every attempt, but a flaky test can pass on a retry and go unnoticed.
