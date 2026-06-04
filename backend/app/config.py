from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


def _default_appliance_root() -> Path:
    override = os.getenv("URN_NEXUS_APPLIANCE_ROOT") or os.getenv("APPLIANCE_ROOT")
    if override and override.strip():
        return Path(override).expanduser().resolve()

    # The appliance repository lives next to this repo in the current workspace.
    return Path(__file__).resolve().parents[3] / "appliance"


class ApplianceSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appliance_root: Path = Field(default_factory=_default_appliance_root)
    sample_projects_dirname: str = "sample_projects"
    runtime_dirname: str = ".riveanbud_runtime"

    def resolved_appliance_root(self) -> Path:
        return self.appliance_root.expanduser().resolve()

    def sample_projects_root(self) -> Path:
        return self.resolved_appliance_root() / self.sample_projects_dirname

    def runtime_roots(self) -> list[Path]:
        roots = [self.resolved_appliance_root() / self.runtime_dirname]
        runtime_override = os.getenv("RIVEANBUD_RUNTIME_DIR")
        if runtime_override and runtime_override.strip():
            roots.append(Path(runtime_override).expanduser())
        return list(dict.fromkeys(path.resolve(strict=False) for path in roots))

