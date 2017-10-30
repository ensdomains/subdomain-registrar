pragma solidity ^0.4.10;

import "./ENS.sol";
import "./HashRegistrarSimplified.sol";

/**
 * @dev Custodian provides a way for owners of ENS deeds to restrict their
 *      ability to make changes to a name they own. Once ownership of a deed is
 *      transferred to Custodian, the original owner may not do anything with
 *      the deed other than transfer ownership to another account until the
 *      registrar is upgraded, at which point they may claim back ownership of
 *      the deed. The transfer function allows owners to precommit to an upgrade
 *      path before the new registrar is deployed.
 */
contract Custodian {
    // namehash('eth')
    bytes32 constant REGISTRAR_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    ENS public ens;
    HashRegistrarSimplified public registrar;
    mapping(bytes32=>address) owners;

    function Custodian(ENS _ens) {
        ens = _ens;
        registrar = HashRegistrarSimplified(ens.owner(REGISTRAR_NODE));
    }

    /**
     * @dev owner returns the address of the account that owns a deed. Initially
     *      this is the owner of the deed according to the registry, or the
     *      previousOwner if ownership has already been transferred to this
     *      contract. Afterwards, the owner may transfer control to anther account.
     * @param label The label hash of the deed to check.
     * @return The address owning the deed.
     */
    function owner(bytes32 label) constant returns(address) {
        if(owners[label] != 0) {
            return owners[label];
        }
        var (,deedAddress,,,) = registrar.entries(label);

        var deed = Deed(deedAddress);
        var deedOwner = deed.owner();
        if(deedOwner == address(this)) {
            return deed.previousOwner();
        }
        return deedOwner;
    }

    modifier owner_only(bytes32 label) {
        require(owner(label) == msg.sender);
        _;
    }

    modifier new_registrar() {
        require(ens.owner(REGISTRAR_NODE) != address(registrar));
        _;
    }

    /**
     * @dev Transfers control of a deed to a new account.
     * @param label The label hash of the deed to transfer.
     * @param newOwner The address of the new owner.
     */
    function transfer(bytes32 label, address newOwner) owner_only(label) {
        owners[label] = newOwner;
    }

    /**
     * @dev Claims back the deed after a registrar upgrade.
     * @param label The label hash of the deed to transfer.
     */
    function claim(bytes32 label) owner_only(label) new_registrar {
        registrar.transfer(label, msg.sender);
    }
}
