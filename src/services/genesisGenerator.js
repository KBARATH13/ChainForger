/**
 * Genesis Generator Service
 * Dynamically constructs geth-compatible Clique PoA, IBFT, or custom Anvil genesis models
 */
class GenesisGenerator {
  /**
   * Generate an EVM-compliant genesis JSON object
   * @param {Object} options
   */
  static generateGenesis({
    chainId = 1337,
    consensus = 'clique', // 'clique', 'pos', 'ibft'
    blockTime = 2,
    gasLimit = '0x1fffffffffffff',
    signers = ['0xa5e70e48acb99a0d31dad3d8f10df85e8cf5102c'],
    faucetAllocations = {},
    epoch = 30000
  }) {
    // Construct Clique extradata vanity (32 bytes 0x00) + signers (20 bytes each) + seal (65 bytes 0x00)
    let extradata = '0x' + '00'.repeat(32);
    for (const signer of signers) {
      const cleanSigner = signer.toLowerCase().replace('0x', '');
      extradata += cleanSigner;
    }
    extradata += '00'.repeat(65);

    const alloc = {};
    // Pre-allocate initial signer and faucet accounts
    for (const signer of signers) {
      alloc[signer.toLowerCase().replace('0x', '')] = {
        balance: '0x1000000000000000000000000000000000000000000000000000000000000000'
      };
    }

    // Allocate custom faucet recipients
    for (const [address, balanceHex] of Object.entries(faucetAllocations)) {
      alloc[address.toLowerCase().replace('0x', '')] = {
        balance: balanceHex.startsWith('0x') ? balanceHex : `0x${BigInt(balanceHex).toString(16)}`
      };
    }

    const config = {
      chainId: Number(chainId),
      homesteadBlock: 0,
      eip150Block: 0,
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      istanbulBlock: 0,
      berlinBlock: 0,
      londonBlock: 0
    };

    if (consensus === 'clique') {
      config.clique = {
        period: Number(blockTime),
        epoch: Number(epoch)
      };
    } else if (consensus === 'ibft') {
      config.ibft2 = {
        blockperiodseconds: Number(blockTime),
        epochlength: Number(epoch),
        requesttimeoutseconds: 4
      };
    } else {
      // simulated pos / ethash base
      config.ethash = {};
    }

    return {
      config,
      difficulty: '1',
      gasLimit: gasLimit.startsWith('0x') ? gasLimit : `0x${parseInt(gasLimit).toString(16)}`,
      extradata,
      alloc
    };
  }
}

module.exports = GenesisGenerator;

