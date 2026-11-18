// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BaseRBAC
 * @dev Extends OpenZeppelin AccessControl with predefined roles for the ChainForger system.
 */
contract BaseRBAC is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    /**
     * @dev Initializes the contract assigning the caller as the admin and default operator/auditor.
     * @param admin Address that receives the DEFAULT_ADMIN_ROLE.
     */
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // Grant admin also the operator and auditor roles for initial setup.
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
    }

    // ----- Role management helpers (admin only) -----
    function grantOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(OPERATOR_ROLE, account);
    }

    function revokeOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(OPERATOR_ROLE, account);
    }

    function grantAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(AUDITOR_ROLE, account);
    }

    function revokeAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(AUDITOR_ROLE, account);
    }
}
