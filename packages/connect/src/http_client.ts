import {assert} from '@powerchain/assert';
import {schemas} from '@powerchain/json-schemas';
import {
    APIOrder,
    AssetPairsRequestOpts,
    AssetPairsResponse,
    FeeRecipientsResponse,
    OrderbookRequest,
    OrderbookResponse,
    OrderConfigRequest,
    OrderConfigResponse,
    OrdersRequestOpts,
    OrdersResponse,
    PagedRequestOpts,
    SignedOrder,
} from '@powerchain/types';
import {fetchAsync} from '@powerchain/utils';
import * as _ from 'lodash';
import * as queryString from 'query-string';

import {HttpRequestOptions, HttpRequestType} from './types';
import {relayerResponseJsonParsers} from './utils/relayer_response_json_parsers';

const TRAILING_SLASHES_REGEX = /\/+$/;

/**
 * This class includes all the functionality related to interacting with a set of HTTP endpoints
 * that implement the standard relayer API v2
 */
export class HttpClient {
    private readonly _apiEndpointUrl: string;
    /**
     * Format parameters to be appended to http requests into query string form
     */
    private static _buildQueryStringFromHttpParams(params?: object): string {
        // if params are undefined or empty, return an empty string
        if (params === undefined || _.isEmpty(params)) {
            return '';
        }
        // stringify the formatted object
        const stringifiedParams = queryString.stringify(params);
        return `?${stringifiedParams}`;
    }
    /**
     * Instantiates a new HttpClient instance
     * @param   url    The relayer API base HTTP url you would like to interact with
     * @return  An instance of HttpClient
     */
    constructor(url: string) {
        assert.isWebUri('url', url);
        this._apiEndpointUrl = url.replace(TRAILING_SLASHES_REGEX, ''); // remove trailing slashes
    }
    /**
     * Retrieve assetData pair info from the API
     * @param   requestOpts     Options specifying assetData information to retrieve, page information.
     * @return  The resulting AssetPairsResponse that match the request
     */
    public async getAssetPairsAsync(
        requestOpts?: AssetPairsRequestOpts & PagedRequestOpts,
    ): Promise<AssetPairsResponse> {
        if (requestOpts !== undefined) {
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.assetPairsRequestOptsSchema);
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.pagedRequestOptsSchema);
        }
        const httpRequestOpts = {
            params: requestOpts,
        };
        const responseJson = await this._requestAsync('/asset_pairs', HttpRequestType.Get, httpRequestOpts);
        const assetDataPairs = relayerResponseJsonParsers.parseAssetDataPairsJson(responseJson);
        return assetDataPairs;
    }
    /**
     * Retrieve orders from the API
     * @param   requestOpts     Options specifying orders to retrieve and page information, page information.
     * @return  The resulting OrdersResponse that match the request
     */
    public async getOrdersAsync(requestOpts?: OrdersRequestOpts & PagedRequestOpts): Promise<OrdersResponse> {
        if (requestOpts !== undefined) {
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.ordersRequestOptsSchema);
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.pagedRequestOptsSchema);
        }
        const httpRequestOpts = {
            params: requestOpts,
        };
        const responseJson = await this._requestAsync(`/orders`, HttpRequestType.Get, httpRequestOpts);
        const orders = relayerResponseJsonParsers.parseOrdersJson(responseJson);
        return orders;
    }
    /**
     * Retrieve a specific order from the API
     * @param   orderHash     An orderHash generated from the desired order
     * @return  The APIOrder that matches the supplied orderHash
     */
    public async getOrderAsync(orderHash: string): Promise<APIOrder> {
        assert.doesConformToSchema('orderHash', orderHash, schemas.orderHashSchema);
        const responseJson = await this._requestAsync(`/order/${orderHash}`, HttpRequestType.Get);
        const order = relayerResponseJsonParsers.parseAPIOrderJson(responseJson);
        return order;
    }
    /**
     * Retrieve an orderbook from the API
     * @param   request         An OrderbookRequest instance describing the specific orderbook to retrieve
     * @param   requestOpts     Options specifying page information.
     * @return  The resulting OrderbookResponse that matches the request
     */
    public async getOrderbookAsync(
        request: OrderbookRequest,
        requestOpts?: PagedRequestOpts,
    ): Promise<OrderbookResponse> {
        assert.doesConformToSchema('request', request, schemas.orderBookRequestSchema);
        if (requestOpts !== undefined) {
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.pagedRequestOptsSchema);
        }
        const httpRequestOpts = {
            params: _.defaults({}, request, requestOpts),
        };
        const responseJson = await this._requestAsync('/orderbook', HttpRequestType.Get, httpRequestOpts);
        const orderbook = relayerResponseJsonParsers.parseOrderbookResponseJson(responseJson);
        return orderbook;
    }
    /**
     * Retrieve fee information from the API
     * @param   request         A OrderConfigRequest instance describing the specific fees to retrieve
     * @return  The resulting OrderConfigResponse that matches the request
     */
    public async getOrderConfigAsync(request: OrderConfigRequest): Promise<OrderConfigResponse> {
        assert.doesConformToSchema('request', request, schemas.orderConfigRequestSchema);
        const httpRequestOpts = {
            payload: request,
        };
        const responseJson = await this._requestAsync('/order_config', HttpRequestType.Post, httpRequestOpts);
        const fees = relayerResponseJsonParsers.parseOrderConfigResponseJson(responseJson);
        return fees;
    }
    /**
     * Retrieve the list of fee recipient addresses used by the relayer.
     * @param   requestOpts     Options specifying page information.
     * @return  The resulting FeeRecipientsResponse
     */
    public async getFeeRecipientsAsync(requestOpts?: PagedRequestOpts): Promise<FeeRecipientsResponse> {
        if (requestOpts !== undefined) {
            assert.doesConformToSchema('requestOpts', requestOpts, schemas.pagedRequestOptsSchema);
        }
        const httpRequestOpts = {
            params: requestOpts,
        };
        const feeRecipients = await this._requestAsync('/fee_recipients', HttpRequestType.Get, httpRequestOpts);
        assert.doesConformToSchema('feeRecipients', feeRecipients, schemas.relayerApiFeeRecipientsResponseSchema);
        return feeRecipients;
    }
    /**
     * Submit a signed order to the API
     * @param   signedOrder     A SignedOrder instance to submit
     */
    public async submitOrderAsync(signedOrder: SignedOrder): Promise<void> {
        assert.doesConformToSchema('signedOrder', signedOrder, schemas.signedOrderSchema);
        const httpRequestOpts = {
            payload: signedOrder,
        };
        await this._requestAsync('/order', HttpRequestType.Post, httpRequestOpts);
    }
    private async _requestAsync(
        path: string,
        requestType: HttpRequestType,
        requestOptions?: HttpRequestOptions,
    ): Promise<any> {
        const params = _.get(requestOptions, 'params');
        const payload = _.get(requestOptions, 'payload');
        const query = HttpClient._buildQueryStringFromHttpParams(params);
        const url = `${this._apiEndpointUrl}${path}${query}`;
        const headers = new Headers({
            'content-type': 'application/json',
        });
        const response = await fetchAsync(url, {
            method: requestType,
            body: JSON.stringify(payload),
            headers,
        });
        const text = await response.text();
        if (!response.ok) {
            const errorString = `${response.status} - ${response.statusText}\n${requestType} ${url}\n${text}`;
            throw Error(errorString);
        }
        const result = !_.isEmpty(text) ? JSON.parse(text) : undefined;
        return result;
    }
}
