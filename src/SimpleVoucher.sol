// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SimpleVoucher
 * @notice A simple voucher issuing and redeeming contract with ERC-1967 upgradeable proxy support
 */
contract SimpleVoucher is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// @notice Voucher status enum
    enum Status {
        Nonexist, // 0 - Voucher does not exist
        Issued,   // 1 - Voucher has been issued
        Redeemed  // 2 - Voucher has been redeemed
    }

    /// @notice Mapping: issuer => topicHash => voucherHash => Status
    mapping(address issuer => mapping(bytes32 topicHash => mapping(bytes32 voucherHash => Status))) public vouchers;

    /// @notice Emitted when vouchers are issued
    event VouchersIssued(
        address indexed issuer,
        string topic,
        bytes32 indexed topicHash
    );

    /// @notice Emitted when a single voucher is issued (for indexing individual vouchers)
    event VoucherIssued(
        address indexed issuer,
        bytes32 indexed topicHash,
        bytes32 indexed voucherHash
    );

    /// @notice Emitted when a voucher is redeemed
    event VoucherRedeemed(
        address indexed issuer,
        address indexed redeemer,
        bytes32 indexed topicHash,
        bytes32 voucherHash
    );

    /// @notice Error when voucher already exists
    error VoucherAlreadyExists(bytes32 voucherHash);

    /// @notice Error when voucher does not exist
    error VoucherDoesNotExist(bytes32 voucherHash);

    /// @notice Error when voucher is already redeemed
    error VoucherAlreadyRedeemed(bytes32 voucherHash);

    /// @notice Error when no voucher hashes provided
    error EmptyVoucherHashes();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param owner_ The owner of the contract (can upgrade)
     */
    function initialize(address owner_) public initializer {
        __Ownable_init(owner_);
    }

    /**
     * @notice Issue basic vouchers under a topic
     * @param topic The topic string for the vouchers
     * @param voucherHashes Array of voucher hashes to register
     */
    function issueBasicVouchers(string calldata topic, bytes32[] calldata voucherHashes) external {
        if (voucherHashes.length == 0) {
            revert EmptyVoucherHashes();
        }

        bytes32 topicHash = keccak256(abi.encodePacked(topic));
        address issuer = msg.sender;

        for (uint256 i = 0; i < voucherHashes.length; i++) {
            bytes32 voucherHash = voucherHashes[i];

            if (vouchers[issuer][topicHash][voucherHash] != Status.Nonexist) {
                revert VoucherAlreadyExists(voucherHash);
            }

            vouchers[issuer][topicHash][voucherHash] = Status.Issued;

            emit VoucherIssued(issuer, topicHash, voucherHash);
        }

        emit VouchersIssued(issuer, topic, topicHash);
    }

    /**
     * @notice Redeem a voucher
     * @param issuer The address that issued the voucher
     * @param topic The topic string the voucher was issued under
     * @param voucher The raw voucher value (will be hashed to verify)
     */
    function redeemVoucher(address issuer, string calldata topic, bytes32 voucher) external {
        bytes32 topicHash = keccak256(abi.encodePacked(topic));
        bytes32 voucherHash = keccak256(abi.encodePacked(voucher));
        Status status = vouchers[issuer][topicHash][voucherHash];

        if (status == Status.Nonexist) {
            revert VoucherDoesNotExist(voucherHash);
        }

        if (status == Status.Redeemed) {
            revert VoucherAlreadyRedeemed(voucherHash);
        }

        vouchers[issuer][topicHash][voucherHash] = Status.Redeemed;

        emit VoucherRedeemed(issuer, msg.sender, topicHash, voucherHash);
    }

    /**
     * @notice Redeem a binding voucher by providing a signature
     * @param issuer The address that issued the voucher
     * @param topic The topic string the voucher was issued under
     * @param digest The digest that was signed
     * @param signature The signature produced by the voucher's private key
     */
    function redeemBindingVoucher(
        address issuer,
        string calldata topic,
        bytes32 digest,
        bytes calldata signature
    ) external {
        address signer = ECDSA.recover(digest, signature);
        bytes32 voucherHash = keccak256(abi.encodePacked(signer));
        bytes32 topicHash = keccak256(abi.encodePacked(topic));
        Status status = vouchers[issuer][topicHash][voucherHash];

        if (status == Status.Nonexist) revert VoucherDoesNotExist(voucherHash);
        if (status == Status.Redeemed) revert VoucherAlreadyRedeemed(voucherHash);

        vouchers[issuer][topicHash][voucherHash] = Status.Redeemed;
        emit VoucherRedeemed(issuer, msg.sender, topicHash, voucherHash);
    }

    /**
     * @notice Get voucher status
     * @param issuer The issuer address
     * @param topic The topic string
     * @param voucherHash The voucher hash
     * @return The status of the voucher
     */
    function getVoucherStatus(
        address issuer,
        string calldata topic,
        bytes32 voucherHash
    ) external view returns (Status) {
        bytes32 topicHash = keccak256(abi.encodePacked(topic));
        return vouchers[issuer][topicHash][voucherHash];
    }

    /**
     * @notice Authorizes upgrade to a new implementation
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
