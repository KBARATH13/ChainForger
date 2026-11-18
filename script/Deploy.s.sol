// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BaseRBAC.sol";
import "../src/AuditVault.sol";
import "../src/CustomToken.sol";

/**
 * @title DeployScript
 * @dev Deploys BaseRBAC, AuditVault, and CustomToken contracts.
 * Accepts optional PRIVATE_KEY from environment or defaults to the standard Foundry/Anvil dev key.
 */
contract DeployScript is Script {
    // Default Anvil Account (0) private key for local development
    uint256 constant DEFAULT_DEV_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        // Read PRIVATE_KEY if provided, otherwise fallback to standard default key
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", DEFAULT_DEV_KEY);
        address deployer = vm.addr(deployerKey);

        console.log("Deploying ChainForger contracts with deployer:", deployer);

        vm.startBroadcast(deployerKey);

        // 1. Deploy BaseRBAC
        BaseRBAC baseRBAC = new BaseRBAC(deployer);
        console.log("BaseRBAC deployed at:", address(baseRBAC));

        // 2. Deploy AuditVault
        AuditVault auditVault = new AuditVault(deployer);
        console.log("AuditVault deployed at:", address(auditVault));

        // 3. Deploy CustomToken
        CustomToken token = new CustomToken(
            "ChainForger Token",
            "CFG",
            18,
            1_000_000,
            deployer,
            deployer
        );
        console.log("CustomToken deployed at:", address(token));

        // Grant operator role on vault and token to deployer (already handled in constructor/setup)
        console.log("--- Deployment Completed Successfully ---");

        vm.stopBroadcast();
    }
}
