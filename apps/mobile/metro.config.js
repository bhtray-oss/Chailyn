const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch both app and monorepo root node_modules
config.watchFolders = [monorepoRoot]

// Resolve from app first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Resolve pnpm's virtual store structure
config.resolver.disableHierarchicalLookup = false

module.exports = config
