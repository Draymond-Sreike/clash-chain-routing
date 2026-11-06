// Generated per user. Apply at the target subscription's script entry.
const chainSettings = __CHAIN_SETTINGS__;

function main(input) {
  const config = JSON.parse(JSON.stringify(input));
  const settings = chainSettings;
  const nodes = config.proxies || [];
  const groups = config['proxy-groups'] || [];
  const providers = config['proxy-providers'] || {};
  const originalNames = nodes.map(node => node.name);
  const targetNames = settings.targets.map(target => target.name);
  const groupNames = groups.map(group => group.name);
  if (new Set(originalNames).size !== originalNames.length || new Set(groupNames).size !== groupNames.length) {
    throw new Error('存在重复节点或选择组名称，请先核对原配置。');
  }
  if (originalNames.some(name => groupNames.includes(name))) {
    throw new Error('节点与选择组名称冲突，请先核对原配置。');
  }
  if (nodes.some(node => [settings.frontGroup, settings.exitGroup].includes(node.name))) {
    throw new Error('拟建选择组与已有节点同名。');
  }
  if (groups.some(group => group.name === settings.bypassName)) {
    throw new Error('直连选项与已有选择组同名。');
  }

  const targets = settings.targets.map(expected => {
    const node = nodes.find(item => item.name === expected.name);
    if (!node || node.server !== expected.server || Number(node.port) !== expected.port) {
      throw new Error('目标节点身份发生变化，请重新核对节点名称、服务器和端口。');
    }
    const oldDialer = node['dialer-proxy'];
    if (oldDialer && !['DIRECT', settings.frontGroup].includes(oldDialer) && !settings.replaceExistingDialer) {
      throw new Error('目标节点已有其他前置链路，请先确认是否替换。');
    }
    return node;
  });

  const oldProvider = providers[settings.providerName];
  if (oldProvider && (oldProvider.type !== 'http' || oldProvider.url !== settings.airportURL || oldProvider.path !== settings.providerPath)) {
    throw new Error('同名机场 provider 的来源或路径不同，请为本次配置选择独立名称或核对迁移。');
  }
  const oldFront = groups.find(group => group.name === settings.frontGroup);
  if (oldFront && (oldFront.type !== 'select' || JSON.stringify(oldFront.use) !== JSON.stringify([settings.providerName]) || JSON.stringify(oldFront.proxies) !== JSON.stringify([settings.bypassName]))) {
    throw new Error('已有前置组结构不同，请先合并原配置。');
  }
  const oldExit = groups.find(group => group.name === settings.exitGroup);
  if (oldExit) {
    if (oldExit.type !== 'select' || oldExit.use?.length || oldExit['include-all'] || oldExit['include-all-providers'] || oldExit.filter || oldExit['exclude-filter'] || oldExit['exclude-type']) {
      throw new Error('出口组使用了其他节点源、自动选择或筛选，请先确认双出口的合并方式。');
    }
    if ((oldExit.proxies || []).some(name => !targetNames.includes(name))) {
      throw new Error('出口组含其他选项，请先确认这些选项的合并方式。');
    }
    if (oldExit['include-all-proxies'] && originalNames.some(name => !targetNames.includes(name) && name !== settings.bypassName)) {
      throw new Error('出口组自动包含其他节点，请先确认双出口的合并方式。');
    }
  }

  const bypass = nodes.find(node => node.name === settings.bypassName);
  if (bypass && (bypass.type !== 'direct' || Object.keys(bypass).some(key => !['name', 'type'].includes(key)))) {
    throw new Error('直连选项名称与已有复杂节点冲突。');
  }

  // Freeze existing automatic membership before adding the bypass node/provider.
  for (const group of groups) {
    if ([settings.frontGroup, settings.exitGroup].includes(group.name)) continue;
    if (group['include-all'] || group['include-all-providers']) {
      throw new Error('其他组自动包含所有 provider，请先明确新增机场对这些组的影响。');
    }
    if (group['include-all-proxies']) {
      if (group.filter || group['exclude-filter'] || group['exclude-type']) {
        throw new Error('其他组自动包含节点且有筛选，请按原筛选语义适配。');
      }
      group.proxies = [...new Set([...(group.proxies || []), ...originalNames])];
      group['include-all-proxies'] = false;
    }
  }

  for (const node of targets) node['dialer-proxy'] = settings.frontGroup;
  if (!bypass) nodes.push({ name: settings.bypassName, type: 'direct' });
  const provider = {
    type: 'http',
    url: settings.airportURL,
    path: settings.providerPath,
    interval: settings.interval,
    proxy: 'DIRECT',
    header: { 'User-Agent': [settings.userAgent] },
    override: { 'dialer-proxy': 'DIRECT' },
    'health-check': { enable: false, url: settings.testURL }
  };
  if (settings.excludeFilter) provider['exclude-filter'] = settings.excludeFilter;
  providers[settings.providerName] = provider;
  const exit = {
    ...(oldExit || {}),
    name: settings.exitGroup,
    type: 'select',
    'include-all-proxies': false,
    proxies: targetNames
  };
  const front = {
    name: settings.frontGroup,
    type: 'select',
    proxies: [settings.bypassName],
    use: [settings.providerName]
  };
  const nextGroups = groups.map(group => {
    if (group.name === settings.exitGroup) return exit;
    if (group.name === settings.frontGroup) return front;
    return group;
  });
  if (!oldExit) nextGroups.push(exit);
  if (!oldFront) nextGroups.push(front);
  config.proxies = nodes;
  config['proxy-groups'] = nextGroups;
  config['proxy-providers'] = providers;

  if (Object.keys(settings.airportDnsPolicies).length) {
    if (!config.dns || config.dns.enable === false) {
      throw new Error('机场需要专用 DNS，而原配置 DNS 未启用，请先确定解析方式。');
    }
    if (!Array.isArray(config.dns['proxy-server-nameserver']) || !config.dns['proxy-server-nameserver'].length) {
      throw new Error('配置节点专用 DNS 策略前，需要先确定并填写 proxy-server-nameserver。');
    }
    config.dns['nameserver-policy'] = {
      ...(config.dns['nameserver-policy'] || {}),
      ...settings.airportDnsPolicies
    };
    config.dns['proxy-server-nameserver-policy'] = {
      ...(config.dns['proxy-server-nameserver-policy'] || {}),
      ...settings.airportDnsPolicies
    };
  }
  return config;
}
