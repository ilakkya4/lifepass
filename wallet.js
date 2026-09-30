const { ethers } = require('ethers');

const w = ethers.Wallet.createRandom();
console.log('\n🔐 NEW POLYGON AMOY WALLET\n');
console.log('📍 Address:      ', w.address);
console.log('🔑 Private Key:  ', w.privateKey);
console.log('\n📌 NEXT STEPS:');
console.log('1. Copy private key to .env as WALLET_PRIVATE_KEY');
console.log('2. Get free MATIC: https://faucet.polygon.technology/');
console.log('   Paste address:', w.address);
console.log('3. Wait 30 seconds for 0.5 MATIC\n');