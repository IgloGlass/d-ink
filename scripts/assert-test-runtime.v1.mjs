const SUPPORTED_NODE_MAJORS_V1 = [20, 22];
const OVERRIDE_ENV_KEY_V1 = "DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME";
let hasWarnedForOverrideV1 = false;

function parseNodeMajorV1(version) {
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) ? major : null;
}

function buildUnsupportedRuntimeMessageV1(detectedVersion) {
  const supportedMajorsLabel = SUPPORTED_NODE_MAJORS_V1.map(
    (major) => `${major}.x`,
  ).join(" or ");

  return [
    `[test-runtime] Unsupported Node.js runtime detected: ${detectedVersion}`,
    `[test-runtime] Supported runtime for test execution: Node ${supportedMajorsLabel}.`,
    `[test-runtime] Switch to Node ${supportedMajorsLabel} to run npm test/check reliably.`,
    `[test-runtime] Temporary bypass (not for CI): set ${OVERRIDE_ENV_KEY_V1}=1.`,
  ].join("\n");
}

export function assertSupportedTestRuntimeV1() {
  const detectedVersion = process.versions.node;
  const major = parseNodeMajorV1(detectedVersion);
  if (major !== null && SUPPORTED_NODE_MAJORS_V1.includes(major)) {
    return;
  }

  const hasOverride = process.env[OVERRIDE_ENV_KEY_V1] === "1";
  if (hasOverride) {
    if (!hasWarnedForOverrideV1) {
      const supportedMajorsLabel = SUPPORTED_NODE_MAJORS_V1.map(
        (supportedMajor) => `${supportedMajor}.x`,
      ).join(" or ");
      process.stderr.write(
        `[test-runtime] Warning: bypassing Node ${supportedMajorsLabel} policy via ${OVERRIDE_ENV_KEY_V1}=1 (detected ${detectedVersion}).\n`,
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
