import {hexUtils} from '@powerchain/utils';

import {constants} from './constants';

/**
 * Generates a random address.
 */
export function randomAddress(): string {
    return hexUtils.random(constants.ADDRESS_LENGTH);
}
