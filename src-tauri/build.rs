fn main() {
    println!("cargo:rerun-if-changed=windows-app-manifest.xml");
    // Shipped builds request the standard Windows UAC approval. Development
    // and pure unit-test executables keep Tauri's default execution level;
    // their native capture still refuses to start without an elevated token.
    let mut windows = tauri_build::WindowsAttributes::new();
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        windows = windows.app_manifest(include_str!("windows-app-manifest.xml"));
    }
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("Unable to build Luma desktop resources");
}
