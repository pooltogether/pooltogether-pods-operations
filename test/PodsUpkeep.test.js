const { deployMockContract } = require('ethereum-waffle')
const hre = require('hardhat')
const { expect } = require('chai')

let overrides = { gasLimit: 200000000 }

const SENTINAL = '0x0000000000000000000000000000000000000001'

describe('Pods Upkeep', function() {


  let wallet, wallet2
  let podsRegistry;
  let podsUpkeep

  let pod1, pod2, pod3, pod4, pod5, pod6, pod7, pod8, pod9, pod10

  beforeEach(async () => {

    [wallet, wallet2, wallet3, wallet4] = await hre.ethers.getSigners()
  
    const podsRegistryContractFactory = await hre.ethers.getContractFactory("AddressRegistry", wallet, overrides)
    podsRegistry = await podsRegistryContractFactory.deploy("Pods", wallet.address)
  
    const podsUpkeepContractFactory = await hre.ethers.getContractFactory("PodsUpkeepHarness", wallet, overrides)
    podsUpkeep = await podsUpkeepContractFactory.deploy(podsRegistry.address, wallet.address, 0, 5)

    const MockPodArtifact = await hre.artifacts.readArtifact("MockPod")
    pod1 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod2 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod3 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod4 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod5 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod6 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod7 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod8 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod9 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)
    pod10 = await deployMockContract(wallet, MockPodArtifact.abi, overrides)

    await podsRegistry.addAddresses(
      [
        pod1.address,
        pod2.address,
        pod3.address,
        pod4.address,
        pod5.address,
        pod6.address,
        pod7.address,
        pod8.address,
        pod9.address,
        pod10.address
      ]
    )
    
  })

  describe('bitwise operations ', () => {
    it('can update the timestamp per pod', async () => {

      const lastTimestamp = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      const updatedTimestamp = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffff00000000ffffffff")
      expect(await podsUpkeep.updateLastBlockNumberForPodIndex(lastTimestamp, 1, 0)).
      to.equal(updatedTimestamp)
      
      expect(await podsUpkeep.updateLastBlockNumberForPodIndex(lastTimestamp, 2, 0)).
      to.equal(ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffff00000000ffffffffffffffff"))
    
      expect(await podsUpkeep.updateLastBlockNumberForPodIndex(lastTimestamp, 2, "0x1e")).
      to.equal(ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffff0000001effffffffffffffff"))
    })

    it('can update the timestamp per pod from zero', async () => {

      expect(await podsUpkeep.updateLastBlockNumberForPodIndex("0x0", 2, "0x1c")).
      to.equal(ethers.BigNumber.from("0x00000000000000000000000000000000000000000000001c0000000000000000"))
    })

    it('can read the timestamp per pod', async () => {

      expect(await podsUpkeep.wrappedReadLastBlockNumberForPodIndex("0xffffffffffffffffffffffffffffffffffffffff0000001effffffffffffffff", 2)).
      to.equal(ethers.BigNumber.from("0x1e"))
    })

    it('can read the timestamp per pod linked list index', async () => {
            
      expect(await podsUpkeep.readLastBlockNumberForPodIndex(2)).to.equal(ethers.BigNumber.from("0x0"))
    })

  })


  describe('Only owner can call admin functions ', () => {
    it('can update the block interval', async () => {
      expect(await podsUpkeep.updateBlockUpkeepInterval(5))
      expect(await podsUpkeep.updateBlockUpkeepInterval(6)).
        to.emit(podsUpkeep, "UpkeepBlockIntervalUpdated").withArgs(6)

    })

    it('non owner cannot update the block interval', async () => {
      await expect(podsUpkeep.connect(wallet2).updateBlockUpkeepInterval(5)).
        to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('can update the Max Upkeep Batch', async () => {
      
      expect(await podsUpkeep.updateUpkeepBatchLimit(6)).
        to.emit(podsUpkeep, "UpkeepBatchLimitUpdated").withArgs(6)

    })

    it('non owner cannot update the Max Upkeep Batch', async () => {
      await expect(podsUpkeep.connect(wallet2).updateUpkeepBatchLimit(5)).
        to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('able to call checkUpkeep()', () => {
    it('block interval passed, upkeep needed', async () => {
      await podsUpkeep.updateBlockUpkeepInterval(2)
            
      const checkResult = await podsUpkeep.callStatic.checkUpkeep("0x")
      expect(checkResult[0]).to.be.equal(true)
    })

    it('block interval not passed, upkeep not needed', async () => {
      await podsUpkeep.updateBlockUpkeepInterval(1000)
      let provider = hre.ethers.provider

      const checkResult = await podsUpkeep.callStatic.checkUpkeep("0x")
      expect(checkResult[0]).to.be.equal(false)
    })

    it('upkeep not needed, block interval passed, then needed', async () => {
      const provider = hre.ethers.provider

      // performing Upkeep so that the lastUpdatedBlockNumbers are recorded
      await podsUpkeep.updateBlockUpkeepInterval(0)
      
      await pod1.mock.batch.returns(true)
      await pod2.mock.batch.returns(true)
      await pod3.mock.batch.returns(true)
      await pod4.mock.batch.returns(true)
      await pod5.mock.batch.returns(true)
      await pod6.mock.batch.returns(true)
      await pod7.mock.batch.returns(true)
      await pod8.mock.batch.returns(true)
      await pod9.mock.batch.returns(true)
      await pod10.mock.batch.returns(true)

      await podsUpkeep.performUpkeep("0x")


      const upkeepInterval = 200
      await podsUpkeep.updateBlockUpkeepInterval(upkeepInterval)
      // now should not require upkeep since interval has not passed
      const checkResultStart = await podsUpkeep.callStatic.checkUpkeep("0x")
      expect(checkResultStart[0]).to.be.equal(false)

      // move forward the upkeepIntervalnumber of blocks
      for(let index = 0; index < upkeepInterval; index++){
        await provider.send('evm_mine', [])
      }
      // should now require upKeep      
      const checkResultEnd = await podsUpkeep.callStatic.checkUpkeep("0x")
      expect(checkResultEnd[0]).to.be.equal(true)
    })

  })


  describe('able to call performUpkeep()', () => {

    it('can execute batch()', async () => {

      await podsUpkeep.updateBlockUpkeepInterval(1)
   
      // await pod1.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod2.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod3.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod4.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod5.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod6.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod7.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod8.mock.batch.revertsWithReason("batch-mock-revert")
      // await pod9.mock.batch.revertsWithReason("batch-mock-revert")
      // await expect(podsUpkeep.performUpkeep("0x")).to.be.revertedWith("batch-mock-revert")

      await pod1.mock.batch.returns(true)
      await pod2.mock.batch.returns(true)
      await pod3.mock.batch.returns(true)
      await pod4.mock.batch.returns(true)
      await pod5.mock.batch.returns(true)
      await pod6.mock.batch.returns(true)
      await pod7.mock.batch.returns(true)
      await pod8.mock.batch.returns(true)
      await pod9.mock.batch.returns(true)
      await pod10.mock.batch.returns(true)

      await podsUpkeep.performUpkeep("0x")
    })

    it('reverts on execute batch()', async () => {

      await podsUpkeep.updateBlockUpkeepInterval(1)
      await pod1.mock.batch.returns(false)
     
      await expect(podsUpkeep.performUpkeep("0x")).to.be.reverted
    })

  })

});
