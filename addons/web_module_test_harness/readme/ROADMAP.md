- The page loads only the test helpers of `web`. Add helpers from other addons, such as
  `mail`, to `<module_name>.assets_unit_tests`.
- The page uses a stub for the bus `worker_service`, without a WebSocket connection.
- `ModuleHootCase` runs the tests again after a failure, up to `hoot_retries` times.
