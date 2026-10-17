#!/usr/bin/env python3
"""Generate the checked-in Xcode project without external dependencies."""
from pathlib import Path
import hashlib, json, plistlib
root = Path(__file__).resolve().parent.parent
project = root / 'LifeStrong.xcodeproj'
project.mkdir(exist_ok=True)
objects = {}
def uid(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def quote(value): return json.dumps(str(value))
def obj(name, text):
    key = uid(name); objects[key] = text; return key
app_sources = sorted((root / 'LifeStrong').rglob('*.swift'))
ui_sources = sorted((root / 'LifeStrongUITests').glob('*.swift'))
def source_files(paths):
    refs, builds = [], []
    for path in paths:
        rel = path.relative_to(root).as_posix()
        ref = obj(rel, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {quote(rel)}; sourceTree = SOURCE_ROOT;')
        refs.append(ref)
        builds.append(obj('build:'+rel, f'isa = PBXBuildFile; fileRef = {ref};'))
    return refs, builds
app_refs, app_builds = source_files(app_sources)
ui_refs, ui_builds = source_files(ui_sources)
def arr(values): return '(' + ', '.join(values) + ',)'
app_product = obj('app-product', 'isa = PBXFileReference; explicitFileType = wrapper.application; path = LifeStrong.app; sourceTree = BUILT_PRODUCTS_DIR;')
ui_product = obj('ui-product', 'isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = LifeStrongUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;')
products = obj('products', f'isa = PBXGroup; children = {arr([app_product,ui_product])}; name = Products; sourceTree = "<group>";')
main = obj('main', f'isa = PBXGroup; children = {arr(app_refs + ui_refs + [products])}; sourceTree = "<group>";')
def configurations(prefix, settings):
    keys=[]
    for name in ['Debug','Release','CloudKitDebug']:
        values = settings(name)
        body=' '.join(f'{k} = {v};' for k,v in values.items())
        keys.append(obj(prefix+name, f'isa = XCBuildConfiguration; buildSettings = {{ {body} }}; name = {name};'))
    return obj(prefix+'config-list', f'isa = XCConfigurationList; buildConfigurations = {arr(keys)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug;')
common = configurations('project-', lambda name: {'CLANG_ENABLE_MODULES':'YES','SWIFT_VERSION':'5.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0','SDKROOT':'iphoneos','SWIFT_OPTIMIZATION_LEVEL':quote('-O' if name=='Release' else '-Onone'),'DEBUG_INFORMATION_FORMAT':quote('dwarf-with-dsym' if name=='Release' else 'dwarf'),'ENABLE_TESTABILITY':'NO' if name=='Release' else 'YES'})
def app_settings(name):
    cloud=name=='CloudKitDebug'
    return {'PRODUCT_NAME':quote('$(TARGET_NAME)'), 'PRODUCT_BUNDLE_IDENTIFIER':quote('com.vineandvolt.lifestrong.cloud-rehearsal' if cloud else 'com.vineandvolt.lifestrong.rehearsal'), 'CODE_SIGN_STYLE':'Automatic', 'TARGETED_DEVICE_FAMILY':quote('1'), 'INFOPLIST_FILE':quote('Config/CloudKitInfo.plist' if cloud else 'Config/Info.plist'), 'GENERATE_INFOPLIST_FILE':'NO', 'MARKETING_VERSION':'0.1.0', 'CURRENT_PROJECT_VERSION':'1', 'SWIFT_ACTIVE_COMPILATION_CONDITIONS':quote('DEBUG CLOUDKIT_REHEARSAL' if cloud else ('DEBUG' if name=='Debug' else '')), 'CODE_SIGN_ENTITLEMENTS':quote('Config/CloudKitRehearsal.entitlements' if cloud else ''), 'LIFE_STRONG_CLOUDKIT_CONTAINER':quote('iCloud.com.vineandvolt.lifestrong.rehearsal'), 'LD_RUNPATH_SEARCH_PATHS':quote('$(inherited) @executable_path/Frameworks')}
app_configs=configurations('app-',app_settings)
ui_configs=configurations('ui-',lambda name:{'PRODUCT_NAME':quote('$(TARGET_NAME)'),'PRODUCT_BUNDLE_IDENTIFIER':quote('com.vineandvolt.lifestrong.rehearsal.uitests'),'GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'LifeStrong','CODE_SIGN_STYLE':'Automatic','TARGETED_DEVICE_FAMILY':quote('1')})
def phases(prefix,builds):
    return [obj(prefix+'-sources',f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {arr(builds)}; runOnlyForDeploymentPostprocessing = 0;'),obj(prefix+'-frameworks','isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;'),obj(prefix+'-resources','isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')]
app_target=uid('app-target')
proxy=obj('target-proxy',f'isa = PBXContainerItemProxy; containerPortal = {uid("project")}; proxyType = 1; remoteGlobalIDString = {app_target}; remoteInfo = LifeStrong;')
dep=obj('target-dep',f'isa = PBXTargetDependency; target = {app_target}; targetProxy = {proxy};')
obj('app-target',f'isa = PBXNativeTarget; buildConfigurationList = {app_configs}; buildPhases = {arr(phases("app",app_builds))}; buildRules = (); dependencies = (); name = LifeStrong; productName = LifeStrong; productReference = {app_product}; productType = "com.apple.product-type.application";')
ui_target=obj('ui-target',f'isa = PBXNativeTarget; buildConfigurationList = {ui_configs}; buildPhases = {arr(phases("ui",ui_builds))}; buildRules = (); dependencies = {arr([dep])}; name = LifeStrongUITests; productName = LifeStrongUITests; productReference = {ui_product}; productType = "com.apple.product-type.bundle.ui-testing";')
obj('project',f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2700; }}; buildConfigurationList = {common}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {main}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = {arr([app_target,ui_target])};')
content='// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'
content+='\n'.join(f'{key} = {{ {value} }};' for key,value in sorted(objects.items()))
content+=f'\n}}; rootObject = {uid("project")}; }}\n'
(project/'project.pbxproj').write_text(content)
schemes=project/'xcshareddata'/'xcschemes';schemes.mkdir(parents=True,exist_ok=True)
def reference(target,name,product): return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="{product}" BlueprintName="{name}" ReferencedContainer="container:LifeStrong.xcodeproj"/>'
appref=reference(app_target,'LifeStrong','LifeStrong.app');uiref=reference(ui_target,'LifeStrongUITests','LifeStrongUITests.xctest')
for name,configuration,tests in [('LifeStrong','Debug',True),('LifeStrongCloudKitRehearsal','CloudKitDebug',False)]:
    (schemes/(name+'.xcscheme')).write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{appref}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="{configuration}" shouldUseLaunchSchemeArgsEnv="YES"><Testables>{f'<TestableReference skipped="NO">{uiref}</TestableReference>' if tests else ''}</Testables></TestAction>
<LaunchAction buildConfiguration="{configuration}" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{appref}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{appref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="{configuration}"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
info={'CFBundleDisplayName':'Life Strong Lab','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleName':'$(PRODUCT_NAME)','CFBundlePackageType':'APPL','CFBundleShortVersionString':'$(MARKETING_VERSION)','CFBundleVersion':'$(CURRENT_PROJECT_VERSION)','LSRequiresIPhoneOS':True,'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':False},'UILaunchScreen':{},'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait']}
(root/'Config'/'Info.plist').write_bytes(plistlib.dumps(info))
cloud=dict(info,CFBundleDisplayName='Life Strong Cloud Lab',LifeStrongCloudContainer='$(LIFE_STRONG_CLOUDKIT_CONTAINER)',UIBackgroundModes=['remote-notification'])
(root/'Config'/'CloudKitInfo.plist').write_bytes(plistlib.dumps(cloud))
(root/'Config'/'CloudKitRehearsal.entitlements').write_bytes(plistlib.dumps({'aps-environment':'development','com.apple.developer.icloud-container-identifiers':['$(LIFE_STRONG_CLOUDKIT_CONTAINER)'],'com.apple.developer.icloud-services':['CloudKit'],'com.apple.developer.icloud-container-environment':'Development'}))
print('Generated LifeStrong.xcodeproj and local/cloud rehearsal configurations')
