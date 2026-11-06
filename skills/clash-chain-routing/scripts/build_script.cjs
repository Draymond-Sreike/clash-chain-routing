const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function validateSettings(settings) {
  const fields = ['providerName', 'providerPath', 'frontGroup', 'exitGroup', 'bypassName', 'airportURL', 'userAgent', 'testURL'];
  for (const field of fields) {
    if (typeof settings[field] !== 'string' || !settings[field].trim()) {
      throw new Error('Missing or invalid setting: ' + field);
    }
  }
  for (const field of ['airportURL', 'testURL']) {
    const url = new URL(settings[field]);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Expected HTTP(S) URL: ' + field);
  }
  if (!Number.isInteger(settings.interval) || settings.interval < 60) throw new Error('interval must be an integer of at least 60 seconds');
  if (!Array.isArray(settings.targets) || settings.targets.length !== 2) throw new Error('Exactly two target nodes are required');
  if (new Set(settings.targets.map(target => target.role)).size !== 2 || settings.targets.some(target => !['vps', 'residential'].includes(target.role))) {
    throw new Error('Target roles must be vps and residential');
  }
  for (const target of settings.targets) {
    if (typeof target.name !== 'string' || !target.name.trim() || typeof target.server !== 'string' || !target.server.trim()) {
      throw new Error('Target name and server are required');
    }
    if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535) throw new Error('Invalid target port');
  }
  const identities = [settings.frontGroup, settings.exitGroup, settings.bypassName, ...settings.targets.map(target => target.name)];
  if (new Set(identities).size !== identities.length || identities.some(name => ['DIRECT', 'REJECT', 'GLOBAL', 'PASS', 'COMPATIBLE', 'REJECT-DROP'].includes(name))) {
    throw new Error('Group and node names must be distinct and avoid reserved names');
  }
  if (!settings.airportDnsPolicies || typeof settings.airportDnsPolicies !== 'object' || Array.isArray(settings.airportDnsPolicies)) {
    throw new Error('airportDnsPolicies must be an object');
  }
  for (const [domain, values] of Object.entries(settings.airportDnsPolicies)) {
    if (domain.startsWith('rule-set:') || !Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string' || !value.trim())) {
      throw new Error('Invalid airport DNS domain policy');
    }
  }
  if (typeof settings.replaceExistingDialer !== 'boolean') throw new Error('replaceExistingDialer must be explicit');
  if (settings.excludeFilter !== undefined && typeof settings.excludeFilter !== 'string') throw new Error('excludeFilter must be a string');
}

function build(settings) {
  validateSettings(settings);
  const template = fs.readFileSync(path.join(__dirname, '../assets/subscription-script.js'), 'utf8');
  const marker = '__CHAIN_SETTINGS__';
  if (template.split(marker).length !== 2) throw new Error('Template must contain exactly one settings marker');
  // A callback preserves literal replacement characters within private URLs.
  const source = template.replace(marker, () => JSON.stringify(settings, null, 2));
  new vm.Script(source);
  return source;
}

if (require.main === module) {
  try {
    const [settingsPath, outputPath] = process.argv.slice(2);
    if (!settingsPath || !outputPath || process.argv.length !== 4) throw new Error('Usage: node build_script.cjs settings.json output.txt');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''));
    const source = build(settings);
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, source, { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ generated: path.resolve(outputPath), targets: settings.targets.length }));
  } catch (error) {
    // URL parsing errors can embed credentials. Report a bounded, credential-free message.
    console.error(error.code === 'ERR_INVALID_URL' ? 'Invalid URL in settings' : error instanceof SyntaxError ? 'Invalid JSON or generated JavaScript syntax' : error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, validateSettings };
