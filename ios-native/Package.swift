// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "LifeStrongFoundation",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "LifeStrongCore", targets: ["LifeStrongCore"])],
    targets: [
        .target(name: "LifeStrongCore", path: "LifeStrong/Core"),
        .testTarget(name: "LifeStrongCoreTests", dependencies: ["LifeStrongCore"], path: "LifeStrongTests")
    ]
)
