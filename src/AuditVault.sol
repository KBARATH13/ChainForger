
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./BaseRBAC.sol";

/**
 * @title AuditVault
 * @dev Append‑only log for on‑chain audit entries.
 * Only addresses with `OPERATOR_ROLE` can record entries.
 */
contract AuditVault is BaseRBAC {
    // Re‑use the OPERATOR_ROLE from BaseRBAC for permission control

    struct AuditRecord {
        uint256 id;
        bytes32 stateHash;
        uint256 timestamp;
        address operator;
        string metadata;
    }

    AuditRecord[] private _records;
    uint256 private _nextId;

    /**
     * @dev Initializes the contract with the given admin address.
     * The admin receives the default admin role and the auditor role.
     */
    constructor(address admin) BaseRBAC(admin) {}

    /**
     * @dev Record a new audit entry. Callable only by accounts with OPERATOR_ROLE.
     * @param stateHash keccak256 hash of the state snapshot.
     * @param metadata   Human‑readable tag or description.
     * @return id of the newly created record.
     */
    function recordAuditEntry(bytes32 stateHash, string calldata metadata)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        uint256 id = _nextId;
        _records.push(
            AuditRecord({
                id: id,
                stateHash: stateHash,
                timestamp: block.timestamp,
                operator: msg.sender,
                metadata: metadata
            })
        );
        _nextId++;
        emit AuditRecorded(id, stateHash, msg.sender, metadata);
        return id;
    }

    /**
     * @dev Total number of stored records.
     */
    function totalRecords() external view returns (uint256) {
        return _records.length;
    }

    /**
     * @dev Retrieve a single record by its id (index).
     */
    function getRecord(uint256 id) external view returns (AuditRecord memory) {
        require(id < _records.length, "AuditVault: id out of bounds");
        return _records[id];
    }

    /**
     * @dev Verify that a given hash matches the stored hash for a record.
     */
    function verifyStateHash(uint256 id, bytes32 hash) external view returns (bool) {
        require(id < _records.length, "AuditVault: id out of bounds");
        return _records[id].stateHash == hash;
    }

    /**
     * @dev Return a paginated slice of records.
     * @param offset starting index (inclusive)
     * @param limit  maximum number of records to return
     */
    function getRecordsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (AuditRecord[] memory)
    {
        require(offset <= _records.length, "AuditVault: offset out of bounds");
        uint256 remaining = _records.length - offset;
        uint256 size = limit < remaining ? limit : remaining;
        AuditRecord[] memory slice = new AuditRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            slice[i] = _records[offset + i];
        }
        return slice;
    }

    /**
     * @dev Emitted whenever a new audit entry is added.
     */
    event AuditRecorded(
        uint256 indexed id,
        bytes32 indexed stateHash,
        address indexed operator,
        string metadata
    );
}
