// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AuditVault} from "../src/AuditVault.sol";
import {CustomToken} from "../src/CustomToken.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract AuditVaultTest is Test {
    AuditVault internal vault;
    CustomToken internal token;

    address internal admin = address(0xAD01);
    address internal operator = address(0x0F01);
    address internal unauthorized = address(0xDEAD);

    bytes32 internal testHash = keccak256(abi.encodePacked("BLOCK_STATE_SNAPSHOT_V1"));

    function setUp() public {
        vm.startPrank(admin);
        vault = new AuditVault(admin);
        vault.grantOperator(operator);

        token = new CustomToken(
            "ChainForger Token",
            "CFG",
            18,
            1_000_000,
            admin,
            admin
        );
        token.grantOperator(operator);
        vm.stopPrank();
    }

    function test_InitialRoles() public view {
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.OPERATOR_ROLE(), admin));
        assertTrue(vault.hasRole(vault.AUDITOR_ROLE(), admin));
        assertTrue(vault.hasRole(vault.OPERATOR_ROLE(), operator));
        assertFalse(vault.hasRole(vault.OPERATOR_ROLE(), unauthorized));
    }

    function test_RecordAuditEntry_Success() public {
        vm.prank(operator);
        uint256 id = vault.recordAuditEntry(testHash, "ipfs://audit-snapshot-metadata");

        assertEq(id, 0);
        assertEq(vault.totalRecords(), 1);

        AuditVault.AuditRecord memory record = vault.getRecord(0);
        assertEq(record.id, 0);
        assertEq(record.stateHash, testHash);
        assertEq(record.metadata, "ipfs://audit-snapshot-metadata");
        assertEq(record.operator, operator);
        assertTrue(record.timestamp > 0);

        assertTrue(vault.verifyStateHash(0, testHash));
    }

    function test_RecordAuditEntry_UnauthorizedRevert() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        vault.recordAuditEntry(testHash, "malicious-entry");
    }

    function test_Pagination() public {
        vm.startPrank(operator);
        for (uint256 i = 0; i < 5; i++) {
            bytes32 hash = keccak256(abi.encodePacked("STATE_", i));
            vault.recordAuditEntry(hash, "entry-metadata");
        }
        vm.stopPrank();

        assertEq(vault.totalRecords(), 5);

        AuditVault.AuditRecord[] memory slice = vault.getRecordsPaginated(1, 3);
        assertEq(slice.length, 3);
        assertEq(slice[0].id, 1);
        assertEq(slice[1].id, 2);
        assertEq(slice[2].id, 3);
    }

    function test_CustomToken_MintAndBurn() public {
        assertEq(token.balanceOf(admin), 1_000_000 * 10 ** 18);

        vm.prank(operator);
        token.mint(operator, 500 * 10 ** 18);
        assertEq(token.balanceOf(operator), 500 * 10 ** 18);

        vm.prank(operator);
        token.burn(200 * 10 ** 18);
        assertEq(token.balanceOf(operator), 300 * 10 ** 18);

        vm.prank(unauthorized);
        vm.expectRevert();
        token.mint(unauthorized, 100);
    }
}

