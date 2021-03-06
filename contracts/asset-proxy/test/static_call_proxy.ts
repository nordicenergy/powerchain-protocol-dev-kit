import {DevUtilsContract} from '@powerchain/contracts-dev-utils';
import {
    chaiSetup,
    constants,
    expectTransactionFailedAsync,
    expectTransactionFailedWithoutReasonAsync,
    provider,
    txDefaults,
    web3Wrapper,
} from '@powerchain/contracts-test-utils';
import {BlockchainLifecycle} from '@powerchain/dev-utils';
import {AssetProxyId, RevertReason} from '@powerchain/types';
import {AbiEncoder, BigNumber} from '@powerchain/utils';
import * as chai from 'chai';
import * as ethUtil from 'ethereumjs-util';

import {artifacts} from './artifacts';

import {IAssetProxyContract, StaticCallProxyContract, TestStaticCallTargetContract} from './wrappers';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);

describe('StaticCallProxy', () => {
    const amount = constants.ZERO_AMOUNT;
    let fromAddress: string;
    let toAddress: string;

    let devUtils: DevUtilsContract;
    let staticCallProxy: IAssetProxyContract;
    let staticCallTarget: TestStaticCallTargetContract;

    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        [fromAddress, toAddress] = accounts.slice(0, 2);
        const staticCallProxyWithoutTransferFrom = await StaticCallProxyContract.deployFrompowerchainArtifactAsync(
            artifacts.StaticCallProxy,
            provider,
            txDefaults,
            artifacts,
        );
        devUtils = new DevUtilsContract(constants.NULL_ADDRESS, provider);
        staticCallProxy = new IAssetProxyContract(
            staticCallProxyWithoutTransferFrom.address,
            provider,
            txDefaults,
            {},
            StaticCallProxyContract.deployedBytecode,
        );
        staticCallTarget = await TestStaticCallTargetContract.deployFrompowerchainArtifactAsync(
            artifacts.TestStaticCallTarget,
            provider,
            txDefaults,
            artifacts,
        );
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });

    describe('general', () => {
        it('should revert if undefined function is called', async () => {
            const undefinedSelector = 'powerchain01020304';
            await expectTransactionFailedWithoutReasonAsync(
                web3Wrapper.sendTransactionAsync({
                    from: fromAddress,
                    to: staticCallProxy.address,
                    value: constants.ZERO_AMOUNT,
                    data: undefinedSelector,
                }),
            );
        });
        it('should have an id of powerchainc339d10a', async () => {
            const proxyId = await staticCallProxy.getProxyId().callAsync();
            const expectedProxyId = AssetProxyId.StaticCall;
            expect(proxyId).to.equal(expectedProxyId);
        });
    });
    describe('transferFrom', () => {
        it('should revert if assetData lies outside the bounds of calldata', async () => {
            const staticCallData = staticCallTarget.noInputFunction().getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            const txData = staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .getABIEncodedTransactionData();
            const offsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000080';
            const txDataEndBuffer = ethUtil.toBuffer((txData.length - 2) / 2 - 4);
            const paddedTxDataEndBuffer = ethUtil.setLengthLeft(txDataEndBuffer, 32);
            const invalidOffsetToAssetData = ethUtil.bufferToHex(paddedTxDataEndBuffer).slice(2);
            const newAssetData = '0000000000000000000000000000000000000000000000000000000000000304';
            const badTxData = `${txData.replace(offsetToAssetData, invalidOffsetToAssetData)}${newAssetData}`;
            await expectTransactionFailedWithoutReasonAsync(
                web3Wrapper.sendTransactionAsync({
                    to: staticCallProxy.address,
                    from: fromAddress,
                    data: badTxData,
                }),
            );
        });
        it('should revert if the length of assetData is less than 100 bytes', async () => {
            const staticCallData = constants.NULL_BYTES;
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = (await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync()).slice(0, -128);
            const assetDataByteLen = (assetData.length - 2) / 2;
            expect((assetDataByteLen - 4) % 32).to.equal(0);
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert if the offset to `staticCallData` points to outside of assetData', async () => {
            const staticCallData = staticCallTarget.noInputFunction().getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            const offsetToStaticCallData = '0000000000000000000000000000000000000000000000000000000000000060';
            const assetDataEndBuffer = ethUtil.toBuffer((assetData.length - 2) / 2 - 4);
            const paddedAssetDataEndBuffer = ethUtil.setLengthLeft(assetDataEndBuffer, 32);
            const invalidOffsetToStaticCallData = ethUtil.bufferToHex(paddedAssetDataEndBuffer).slice(2);
            const newStaticCallData = '0000000000000000000000000000000000000000000000000000000000000304';
            const badAssetData = `${assetData.replace(
                offsetToStaticCallData,
                invalidOffsetToStaticCallData,
            )}${newStaticCallData}`;
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(badAssetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert if the callTarget attempts to write to state', async () => {
            const staticCallData = staticCallTarget.updateState().getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert with data provided by the callTarget if the staticcall reverts', async () => {
            const staticCallData = staticCallTarget.assertEvenNumber(new BigNumber(1)).getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await expectTransactionFailedAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
                RevertReason.TargetNotEven,
            );
        });
        it('should revert if the hash of the output is different than expected expected', async () => {
            const staticCallData = staticCallTarget.isOddNumber(new BigNumber(0)).getABIEncodedTransactionData();
            const trueAsBuffer = ethUtil.toBuffer('powerchain0000000000000000000000000000000000000000000000000000000000000001');
            const expectedResultHash = ethUtil.bufferToHex(ethUtil.sha3(trueAsBuffer));
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await expectTransactionFailedAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
                RevertReason.UnexpectedStaticCallResult,
            );
        });
        it('should be successful if a function call with no inputs and no outputs is successful', async () => {
            const staticCallData = staticCallTarget.noInputFunction().getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if the staticCallTarget is not a contract and no return value is expected', async () => {
            const staticCallData = 'powerchain0102030405060708';
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(toAddress, staticCallData, expectedResultHash)
                .callAsync();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function call with one static input returns the correct value', async () => {
            const staticCallData = staticCallTarget.isOddNumber(new BigNumber(1)).getABIEncodedTransactionData();
            const trueAsBuffer = ethUtil.toBuffer('powerchain0000000000000000000000000000000000000000000000000000000000000001');
            const expectedResultHash = ethUtil.bufferToHex(ethUtil.sha3(trueAsBuffer));
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function with one dynamic input is successful', async () => {
            const dynamicInput = 'powerchain0102030405060708';
            const staticCallData = staticCallTarget.dynamicInputFunction(dynamicInput).getABIEncodedTransactionData();
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function call returns a complex type', async () => {
            const a = new BigNumber(1);
            const b = new BigNumber(2);
            const staticCallData = staticCallTarget.returnComplexType(a, b).getABIEncodedTransactionData();
            const abiEncoder = new AbiEncoder.DynamicBytes({
                name: '',
                type: 'bytes',
            });
            const aHex = '0000000000000000000000000000000000000000000000000000000000000001';
            const bHex = '0000000000000000000000000000000000000000000000000000000000000002';
            const expectedResults = `${staticCallTarget.address}${aHex}${bHex}`;
            const offset = '0000000000000000000000000000000000000000000000000000000000000020';
            const encodedExpectedResultWithOffset = `powerchain${offset}${abiEncoder.encode(expectedResults).slice(2)}`;
            const expectedResultHash = ethUtil.bufferToHex(
                ethUtil.sha3(ethUtil.toBuffer(encodedExpectedResultWithOffset)),
            );
            const assetData = await devUtils
                .encodeStaticCallAssetData(staticCallTarget.address, staticCallData, expectedResultHash)
                .callAsync();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
    });
});
