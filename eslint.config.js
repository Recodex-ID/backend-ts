import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'output/**',
      'ecosystem.config.js'
    ]
  },
  
  // Base configuration for all files
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    }
  },
  
  // Apply recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  
  // Custom rule overrides
  {
    rules: {
      // Disable rules that conflict with TypeScript or are too strict for development
      'no-undef': 'off',           // TypeScript handles this
      'no-unused-vars': 'off',     // Use TypeScript version instead
      '@typescript-eslint/no-unused-vars': 'off',  // Disable for development
      '@typescript-eslint/no-explicit-any': 'off', // Allow any type for development
      '@typescript-eslint/ban-types': 'off',       // Allow banned types
      '@typescript-eslint/no-inferrable-types': 'off' // Allow explicit types
    }
  }
);