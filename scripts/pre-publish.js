#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Pre-publish checks...\n');

// Check required files
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'src/mobxVueBridge.js',
  'src/mobxVueBridge.d.ts'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ Missing: ${file}`);
    allFilesExist = false;
  }
});

// Check package.json fields
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredFields = ['name', 'version', 'description', 'main', 'author', 'license'];

console.log('\n📦 Package.json validation:');
requiredFields.forEach(field => {
  if (pkg[field]) {
    console.log(`✅ ${field}: ${pkg[field]}`);
  } else {
    console.log(`❌ Missing field: ${field}`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\n🎉 All pre-publish checks passed!');
  console.log('\nYou can now publish with:');
  console.log('npm publish');
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above.');
  process.exit(1);
}