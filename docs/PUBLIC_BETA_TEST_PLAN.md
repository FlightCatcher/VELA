# VELA 20–50 Person Public Beta Test Plan

This document defines the real external test required before declaring VELA stable. Automated tests cannot substitute for independent participants.

## Cohort

Recruit 20–50 consenting testers covering Windows 10/11, Apple Silicon Macs, Intel Macs, systems without NVIDIA graphics, 8/16/32 GB memory, offline/restricted networks and low-disk conditions. Do not collect personal files or conversation contents.

## Continuous-use protocol

Each tester uses VELA for at least five sessions across seven days and completes: clean installation, first-run recommendation, direct-model download with one interruption/resume, ten chat requests, cancellation and restart recovery, data export, update check and uninstall decision. Image testing is optional for capable machines.

## Exit criteria

- at least 20 completed tester reports;
- at least 90% successful first launch;
- at least 85% successful starter-model installation among compatible online machines;
- no unresolved data-loss, credential exposure or destructive-operation defect;
- crash-free session rate of at least 98%;
- every blocker has a reproducible issue, owner and release decision.

## Evidence

Track anonymous tester ID, platform/hardware tier, VELA version, session count, outcome per scenario and linked GitHub issue. Never invent tester records or count maintainers' repeated local runs as external participants.
