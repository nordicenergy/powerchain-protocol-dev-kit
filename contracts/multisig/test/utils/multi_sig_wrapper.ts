import {LogDecoder, Web3ProviderEngine} from '@powerchain/contracts-test-utils';
import {BigNumber} from '@powerchain/utils';
import {Web3Wrapper} from '@powerchain/web3-wrapper';
import {TransactionReceiptWithDecodedLogs} from 'ethereum-types';

import {artifacts} from '../artifacts';
import {MultiSigWalletContract, MultiSigWalletWithTimeLockContract} from '../wrappers';

export class MultiSigWrapper {
    private readonly _multiSig: MultiSigWalletContract | MultiSigWalletWithTimeLockContract;
    private readonly _web3Wrapper: Web3Wrapper;
    private readonly _logDecoder: LogDecoder;
    constructor(
        multiSigContract: MultiSigWalletContract | MultiSigWalletWithTimeLockContract,
        provider: Web3ProviderEngine,
    ) {
        this._multiSig = multiSigContract;
        this._web3Wrapper = new Web3Wrapper(provider);
        this._logDecoder = new LogDecoder(this._web3Wrapper, artifacts);
    }
    public async submitTransactionAsync(
        destination: string,
        data: string,
        from: string,
        opts: { value?: BigNumber } = {},
    ): Promise<TransactionReceiptWithDecodedLogs> {
        const value = opts.value === undefined ? new BigNumber(0) : opts.value;
        const txHash = await this._multiSig.submitTransaction(destination, value, data).sendTransactionAsync({
            from,
        });
        const tx = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return tx;
    }
    public async confirmTransactionAsync(txId: BigNumber, from: string): Promise<TransactionReceiptWithDecodedLogs> {
        const txHash = await this._multiSig.confirmTransaction(txId).sendTransactionAsync({ from });
        const tx = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return tx;
    }
    public async revokeConfirmationAsync(txId: BigNumber, from: string): Promise<TransactionReceiptWithDecodedLogs> {
        const txHash = await this._multiSig.revokeConfirmation(txId).sendTransactionAsync({ from });
        const tx = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return tx;
    }
    public async executeTransactionAsync(
        txId: BigNumber,
        from: string,
        opts: { gas?: number } = {},
    ): Promise<TransactionReceiptWithDecodedLogs> {
        const txHash = await this._multiSig.executeTransaction(txId).sendTransactionAsync({
            from,
            gas: opts.gas,
        });
        const tx = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return tx;
    }
}
