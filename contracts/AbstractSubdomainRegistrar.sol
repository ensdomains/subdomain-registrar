pragma solidity ^0.5.0;

import "@ensdomains/ethregistrar/contracts/BaseRegistrar.sol";
import "@ensdomains/ens/contracts/ENS.sol";
import "./Resolver.sol";
import "./RegistrarInterface.sol";

contract AbstractSubdomainRegistrar is RegistrarInterface {

    // namehash('eth')
    // bytes32 constant public TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    bytes32 constant public TLD_NODE = 0x30f9ae3b1c4766476d11e2bacd21f9dff2c59670d8b8a74a88ebc22aec7020b9;

    uint constant public GRACE_PERIOD = 90 days;

    bool public stopped = false;
    address public registrarOwner;
    address public migration;

    address public registrar;

    // A map of expiry times
    mapping(uint256=>uint) expiries;

    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;

    ENS public ens;
    BaseRegistrar public base;

    modifier owner_only(bytes32 label) {
        require(owner(label) == msg.sender);
        _;
    }

    modifier not_stopped() {
        require(!stopped);
        _;
    }

    modifier registrar_owner_only() {
        require(msg.sender == registrarOwner);
        _;
    }

    event DomainTransferred(bytes32 indexed label, string name);

    constructor(ENS _ens, BaseRegistrar _base) public {
        ens = _ens;
        base = _base;
        registrar = ens.owner(TLD_NODE);
        registrarOwner = msg.sender;
    }

    // Returns the expiration timestamp of the specified id.
    function nameExpires(uint256 id) external view returns(uint) {
        return expiries[id];
    }

    // Returns true iff the specified name is available for registration.
    function available(uint256 id) public view returns(bool) {
        // Not available if it's registered here or in its grace period.
        return expiries[id] + GRACE_PERIOD < now;
    }

    function twitter(bytes32 node) external view returns (string memory) {
        uint256 tokenId = uint256(node);

        string memory _twitterURI = _tokenURIs[tokenId];

        return _twitterURI;
    }

    function _setTwitterURI(string memory name, string memory _tokenURI) public owner_only(keccak256(bytes(name))) {
        bytes32 label = keccak256(bytes(name));
        uint256 tokenId = uint256(label);
        require(available(tokenId));

        _tokenURIs[tokenId] = _tokenURI;
    }

    function doRegistration(bytes32 node, bytes32 label, uint duration, string memory _tokenURI, address subdomainOwner, Resolver resolver) internal {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        uint256 tokenId = uint256(subnode);

        require(available(tokenId));
        require(now + duration + GRACE_PERIOD > now + GRACE_PERIOD); // Prevent future overflow

        expiries[tokenId] = now + duration;
        _tokenURIs[tokenId] = _tokenURI;

        // Get the subdomain so we can configure it
        ens.setSubnodeOwner(node, label, address(this));

        // Set the subdomain's resolver
        ens.setResolver(subnode, address(resolver));

        // Set the address record on the resolver
        resolver.setAddr(subnode, subdomainOwner);

        // Pass ownership of the new subdomain to the registrant
        ens.setOwner(subnode, subdomainOwner);
    }

    function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
        return (
            (interfaceID == 0x01ffc9a7) // supportsInterface(bytes4)
            || (interfaceID == 0xc1b15f5a) // RegistrarInterface
        );
    }

    function rentDue(bytes32 label, string calldata subdomain) external view returns (uint timestamp) {
        return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    }

    /**
     * @dev Sets the resolver record for a name in ENS.
     * @param name The name to set the resolver for.
     * @param resolver The address of the resolver
     */
    function setResolver(string memory name, address resolver) public owner_only(keccak256(bytes(name))) {
        bytes32 label = keccak256(bytes(name));
        bytes32 node = keccak256(abi.encodePacked(TLD_NODE, label));
        ens.setResolver(node, resolver);
    }

    /**
     * @dev Configures a domain for sale.
     * @param name The name to configure.
     * @param price The price in wei to charge for subdomain registrations
     * @param referralFeePPM The referral fee to offer, in parts per million
     */
    function configureDomain(string memory name, uint price, uint referralFeePPM) public {
        configureDomainFor(name, price, referralFeePPM, msg.sender, address(0x0));
    }

    /**
     * @dev Stops the registrar, disabling configuring of new domains.
     */
    function stop() public not_stopped registrar_owner_only {
        stopped = true;
    }

    /**
     * @dev Sets the address where domains are migrated to.
     * @param _migration Address of the new registrar.
     */
    function setMigrationAddress(address _migration) public registrar_owner_only {
        require(stopped);
        migration = _migration;
    }

    function transferOwnership(address newOwner) public registrar_owner_only {
        registrarOwner = newOwner;
    }

    /**
     * @dev Returns information about a subdomain.
     * @param label The label hash for the domain.
     * @param subdomain The label for the subdomain.
     * @return domain The name of the domain, or an empty string if the subdomain
     *                is unavailable.
     * @return price The price to register a subdomain, in wei.
     * @return rent The rent to retain a subdomain, in wei per second.
     * @return referralFeePPM The referral fee for the dapp, in ppm.
     */
    function query(bytes32 label, string calldata subdomain) external view returns (string memory domain, uint price, uint rent, uint referralFeePPM);

    function owner(bytes32 label) public view returns (address);
    function configureDomainFor(string memory name, uint price, uint referralFeePPM, address payable _owner, address _transfer) public;
}
