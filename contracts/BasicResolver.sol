pragma solidity ^0.4.0;

import "./ENS.sol";

/**
 * @dev A basic ENS resolver that simply returns the owner's address for all
 *      addr lookups.
 */
contract BasicResolver {
  ENS public ens;

  function BasicResolver(ENS _ens) public {
    ens = _ens;
  }

  function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
    return interfaceID == 0x01ffc9a7 || interfaceID == 0x3b3b57de;
  }

  function addr(bytes32 node) public view returns (address) {
    return ens.owner(node);
  }
}
