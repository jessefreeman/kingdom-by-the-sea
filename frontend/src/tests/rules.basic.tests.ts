import { CoreRulesPlugin } from '../plugins/rules/core/CoreRulesPlugin';

export function testRulesPlugin() {
  console.log('=== Testing Rules Plugin ===');
  
  try {
    const plugin = new CoreRulesPlugin();
    console.log('✅ CoreRulesPlugin created successfully');
    console.log('Plugin ID:', plugin.id);
    console.log('Plugin Version:', plugin.version);
    
    // Test building specs
    const grassSpecs = plugin.getUpgradeSpecs('grass');
    console.log('✅ Grass upgrade specs:', grassSpecs.length, 'options');
    
    const farmSpecs = plugin.getUpgradeSpecs('farm');  
    console.log('✅ Farm upgrade specs:', farmSpecs.length, 'options');
    
    return true;
  } catch (error) {
    console.error('❌ Rules plugin test failed:', error);
    return false;
  }
}

// Add to global test functions
(window as any).KBTS_ENGINE_TESTS = (window as any).KBTS_ENGINE_TESTS || {};
(window as any).KBTS_ENGINE_TESTS.testRulesPlugin = testRulesPlugin;
