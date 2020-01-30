pragma solidity ^0.5.0;

import "@ensdomains/ethregistrar/contracts/BaseRegistrar.sol";
import "./EthRegistrarSubdomainRegistrar.sol";

/**
 * @dev Implements an ENS registrar that sells subdomains on behalf of their owners.
 *
 * Users may register a subdomain by calling `register` with the name of the domain
 * they wish to register under, and the label hash of the subdomain they want to
 * register. They must also specify the new owner of the domain, and the referrer,
 * who is paid an optional finder's fee. The registrar then configures a simple
 * default resolver, which resolves `addr` lookups to the new owner, and sets
 * the `owner` account as the owner of the subdomain in ENS.
 *
 * New domains may be added by calling `configureDomain`, then transferring
 * ownership in the ENS registry to this contract. Ownership in the contract
 * may be transferred using `transfer`, and a domain may be unlisted for sale
 * using `unlistDomain`. There is (deliberately) no way to recover ownership
 * in ENS once the name is transferred to this registrar.
 *
 * Critically, this contract does not check one key property of a listed domain:
 *
 * - Is the name UTS46 normalised?
 *
 * User applications MUST check these two elements for each domain before
 * offering them to users for registration.
 *
 * Applications should additionally check that the domains they are offering to
 * register are controlled by this registrar, since calls to `register` will
 * fail if this is not the case.
 */
contract ENSMigrationSubdomainRegistrar is EthRegistrarSubdomainRegistrar {

    constructor(ENS ens) EthRegistrarSubdomainRegistrar(ens) public { }

    function migrateSubdomain(bytes32 node, bytes32 label) external {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        address previous = ens.owner(subnode);

        // only allow a contract to run their own migration
        require(!isContract(previous) || msg.sender == previous);

        ens.setSubnodeRecord(node, label, previous, ens.resolver(subnode), ens.ttl(subnode));
    }

    function isContract(address addr) private returns (bool) {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }
}
