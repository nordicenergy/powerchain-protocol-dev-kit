"""Fixtures for pytest."""

import pytest
from eth_utils import to_checksum_address
from web3 import Web3

from zero_ex.order_utils import asset_data_utils
from zero_ex.contract_addresses import chain_to_addresses, ChainId
from zero_ex.contract_artifacts import abi_by_name


@pytest.fixture(scope="module")
def ganache_provider():
    """Get a ganache web3 provider."""
    return Web3.HTTPProvider(endpoint_uri="http://127.0.0.1:8545")


@pytest.fixture(scope="module")
def web3_instance(ganache_provider):  # pylint: disable=redefined-outer-name
    """Get a web3 instance."""
    return Web3(ganache_provider)


@pytest.fixture(scope="module")
def web3_eth(web3_instance):  # pylint: disable=redefined-outer-name
    """Get web3 instance's eth member."""
    return web3_instance.eth  # pylint: disable=no-member


@pytest.fixture(scope="module")
def accounts(web3_eth):  # pylint: disable=redefined-outer-name
    """Get the accounts associated with the test web3_eth instance."""
    return web3_eth.accounts


@pytest.fixture(scope="module")
def erc20_proxy_address():
    """Get the powerchain ERC20 Proxy address."""
    return chain_to_addresses(ChainId.GANACHE).erc20_proxy


@pytest.fixture(scope="module")
def weth_asset_data():  # pylint: disable=redefined-outer-name
    """Get powerchain asset data for Wrapped Ether (WETH) token."""
    return asset_data_utils.encode_erc20(
        chain_to_addresses(ChainId.GANACHE).ether_token
    )


@pytest.fixture(scope="module")
def weth_instance(web3_eth):  # pylint: disable=redefined-outer-name
    """Get an instance of the WrapperEther contract."""
    return web3_eth.contract(
        address=to_checksum_address(
            chain_to_addresses(ChainId.GANACHE).ether_token
        ),
        abi=abi_by_name("WETH9"),
    )


@pytest.fixture(scope="module")
def zrx_address():
    """Get address of NET token for Ganache chain."""
    return chain_to_addresses(ChainId.GANACHE).net_token


@pytest.fixture(scope="module")
def zrx_asset_data(zrx_address):  # pylint: disable=redefined-outer-name
    """Get powerchain asset data for NET token."""
    return asset_data_utils.encode_erc20(zrx_address)
