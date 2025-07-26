use vergen::{BuildBuilder, CargoBuilder, Emitter, RustcBuilder, SysinfoBuilder};
use vergen_gitcl::GitclBuilder;

fn main() {
    init_vergen().unwrap_or_else(|e| {
        eprintln!("Failed to initialize vergen: {}", e);
        std::process::exit(1);
    });
}

fn init_vergen() -> Result<(), Box<dyn std::error::Error>> {
    let build = BuildBuilder::all_build()?;
    let cargo = CargoBuilder::all_cargo()?;
    let rustc = RustcBuilder::all_rustc()?;
    let si = SysinfoBuilder::all_sysinfo()?;
    let gitcl = GitclBuilder::all_git()?;

    Emitter::default()
        .add_instructions(&build)?
        .add_instructions(&cargo)?
        .add_instructions(&rustc)?
        .add_instructions(&si)?
        .add_instructions(&gitcl)?
        .emit()?;

    Ok(())
}
