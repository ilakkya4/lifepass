
require('dotenv').config();
const { ethers } = require('ethers');

let provider = null;
let wallet = null;
let enabled = false;

function init() {
  const rpc = process.env.POLYGON_RPC_URL;
  const pk = process.env.WALLET_PRIVATE_KEY;

  if (!rpc || !pk || pk === '' || pk === '0x' + '0'.repeat(64)) {
    console.warn('⚠️  Blockchain disabled (no wallet configured)');
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(rpc);
    wallet = new ethers.Wallet(pk, provider);
    enabled = true;
    console.log(`🔗 Blockchain enabled. Wallet: ${wallet.address}`);
  } catch (e) {
    console.warn('⚠️  Blockchain init failed:', e.message);
  }
}

async function anchorHash(hash) {
  if (!enabled) return { txHash: null, blockNumber: null, simulated: true, explorerUrl: null };

  try {
    const data = '0x' + hash.slice(0, 64).padEnd(64, '0');
    const tx = await wallet.sendTransaction({ to: wallet.address, value: 0, data });
    console.log(`📡 Anchoring ${hash.slice(0, 16)}... → ${tx.hash}`);
    const receipt = await tx.wait();
    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      simulated: false,
      explorerUrl: (process.env.POLYGON_EXPLORER || 'https://amoy.polygonscan.com/tx/') + tx.hash
    };
  } catch (e) {
    console.error('❌ Anchor failed:', e.message);
    return { txHash: null, blockNumber: null, simulated: false, error: e.message, explorerUrl: null };
  }
}

async function getBalance() {
  if (!enabled) return null;
  try {
    const bal = await provider.getBalance(wallet.address);
    return ethers.formatEther(bal);
  } catch { return null; }
}

function getWalletAddress() { return wallet?.address || null; }

init();

module.exports = { anchorHash, getBalance, getWalletAddress, enabled };