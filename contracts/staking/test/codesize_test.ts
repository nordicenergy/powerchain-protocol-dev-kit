import {constants, expect, getCodesizeFromArtifact} from '@powerchain/contracts-test-utils';

import {artifacts} from './artifacts';

describe('Contract Size Checks', () => {
    describe('Staking', () => {
        it('should have a codesize less than the maximum', async () => {
            const actualSize = getCodesizeFromArtifact(artifacts.Staking);
            expect(actualSize).to.be.lt(constants.MAX_CODE_SIZE);
        });
    });
    describe('StakingProxy', () => {
        it('should have a codesize less than the maximum', async () => {
            const actualSize = getCodesizeFromArtifact(artifacts.StakingProxy);
            expect(actualSize).to.be.lt(constants.MAX_CODE_SIZE);
        });
    });
});
