const SUPPORTED_NODE_MAJOR_V1 = 20;
const OVERRIDE_ENV_KEY_V1 = "DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME";
let hasWarnedForOverrideV1 = false;

function parseNodeMajorV1(version) {
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) ? major : null;
}

function buildUnsupportedRuntimeMessageV1(detectedVersion) {
  return [
    `[test-runtime] Unsupported Node.js runtime detected: ${detectedVersion}`,
    `[test-runtime] Supported runtime for test execution: Node ${SUPPORTED_NODE_MAJOR_V1}.x (LTS).`,
    "[test-runtime] Switch to Node 20 to run npm test/check reliably.",
    `[test-runtime] Temporary bypass (not for CI): set ${OVERRIDE_ENV_KEY_V1}=1.`,
  ].join("\n");
}

export function assertSupportedTestRuntimeV1() {
  const detectedVersion = process.versions.node;
  const major = parseNodeMajorV1(detectedVersion);
  if (major === SUPPORTED_NODE_MAJOR_V1) {
    return;
  }

  const hasOverride = process.env[OVERRIDE_ENV_KEY_V1] === "1";
  if (hasOverride) {
    if (!hasWarnedForOverrideV1) {
      process.stderr.write(
        `[test-runtime] Warning: bypassing Node ${SUPPORTED_NODE_MAJOR_V1}.x policy via ${OVERRIDE_ENV_KEY_V1}=1 (detected ${detectedVersion}).\n`,
      );
      hasWarnedForOverrideV1 = true;
    }
    return;
  }

  throw new Error(buildUnsupportedRuntimeMessageV1(detectedVersion));
}

function main() {
  assertSupportedTestRuntimeV1();
}

main();
