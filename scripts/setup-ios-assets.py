// scripts/setup-ios-assets.py
// 配置 iOS App 名称、图标、启动屏（跨平台，macOS/Windows/Linux 均可运行）
// 需要 Pillow: pip install Pillow
import os, json, shutil, plistlib, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IOS_APP = os.path.join(ROOT, 'ios', 'App', 'App')
APP_NAME = '赵云与阿斗'

def log(msg):
    print(f'[setup-ios] {msg}')

# —— 1. 生成 1024x1024 应用图标 ——
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    log('Pillow not installed, skipping icon generation')
    sys.exit(1)

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
# 红色圆角背景（赵云主题色）
draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=180, fill='#c0392b')
# 内边框装饰
draw.rounded_rectangle([40, 40, SIZE-40, SIZE-40], radius=150, outline='#fab005', width=8)
# 居中"赵"字（黄色）
font_paths = [
    '/System/Library/Fonts/PingFang.ttc',           # macOS
    '/System/Library/Fonts/STHeiti Medium.ttc',      # macOS fallback
    '/Library/Fonts/Arial Unicode.ttf',               # macOS Linux
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', # Linux
    'C:/Windows/Fonts/msyh.ttc',                      # Windows
    'C:/Windows/Fonts/simhei.ttf',                    # Windows
]
font = None
for fp in font_paths:
    try:
        font = ImageFont.truetype(fp, 580)
        log(f'Using font: {fp}')
        break
    except: continue
if font is None:
    font = ImageFont.load_default()
    log('Warning: no CJK font found, using default')
draw.text((SIZE//2, SIZE//2), '赵', fill='#fab005', anchor='mm', font=font)
icon_path = os.path.join(ROOT, 'icon-1024.png')
img.save(icon_path)
log(f'Generated icon: {icon_path}')

# —— 2. 替换 AppIcon.appiconset ——
appicon_dir = os.path.join(IOS_APP, 'Assets.xcassets', 'AppIcon.appiconset')
if not os.path.exists(appicon_dir):
    os.makedirs(appicon_dir, exist_ok=True)
    log(f'Created AppIcon dir: {appicon_dir}')

# iOS 14+ 单尺寸 1024 通用图标
contents = {
    "images": [
        {"filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}
    ],
    "info": {"author": "xcode", "version": 1}
}
with open(os.path.join(appicon_dir, 'Contents.json'), 'w', encoding='utf-8') as f:
    json.dump(contents, f, indent=2, ensure_ascii=False)
shutil.copy(icon_path, os.path.join(appicon_dir, 'icon-1024.png'))
log(f'Replaced AppIcon assets in {appicon_dir}')

# —— 3. 修改 Info.plist：App 名称 ——
plist_path = os.path.join(IOS_APP, 'Info.plist')
if not os.path.exists(plist_path):
    log(f'Warning: Info.plist not found at {plist_path}')
else:
    with open(plist_path, 'rb') as f:
        data = plistlib.load(f)
    data['CFBundleDisplayName'] = APP_NAME
    data['CFBundleName'] = APP_NAME
    # 启动屏标题
    data['UILaunchStoryboardName'] = 'LaunchScreen'
    with open(plist_path, 'wb') as f:
        plistlib.dump(data, f)
    log(f'Updated Info.plist: CFBundleDisplayName={APP_NAME}, CFBundleName={APP_NAME}')

# —— 4. 自定义 LaunchScreen.storyboard（显示游戏标题）——
launch_path = os.path.join(IOS_APP, 'Base.lproj', 'LaunchScreen.storyboard')
if os.path.exists(launch_path):
    # 替换为自定义 storyboard：红色背景 + 居中"赵云与阿斗"标题
    storyboard = '''<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22500" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22500"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="赵云与阿斗" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="zya-Lbl-001">
                                <rect key="frame" x="96.5" y="396" width="200" height="60"/>
                                <fontDescription key="fontDescription" type="boldSystem" pointSize="40"/>
                                <color key="textColor" red="0.9803921568627451" green="0.6274509803921569" blue="0.0196078431372549" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                                <nil key="highlightedColor"/>
                            </label>
                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="文字合成塔防" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="zya-Lbl-002">
                                <rect key="frame" x="146.5" y="464" width="100" height="20"/>
                                <fontDescription key="fontDescription" type="system" pointSize="16"/>
                                <color key="textColor" red="0.7568627450980392" green="0.7058823529411765" blue="0.6235294117647059" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                                <nil key="highlightedColor"/>
                            </label>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="6Tk-OE-BBY"/>
                        <color key="backgroundColor" red="0.7529411764705882" green="0.2235294117647059" blue="0.16862745098039216" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="zya-Lbl-001" firstAttribute="centerX" secondItem="6Tk-OE-BBY" secondAttribute="centerX" id="c1"/>
                            <constraint firstItem="zya-Lbl-001" firstAttribute="centerY" secondItem="6Tk-OE-BBY" secondAttribute="centerY" id="c2"/>
                            <constraint firstItem="zya-Lbl-002" firstAttribute="top" secondItem="zya-Lbl-001" secondAttribute="bottom" constant="8" id="c3"/>
                            <constraint firstItem="zya-Lbl-002" firstAttribute="centerX" secondItem="6Tk-OE-BBY" secondAttribute="centerX" id="c4"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
</document>
'''
    with open(launch_path, 'w', encoding='utf-8') as f:
        f.write(storyboard)
    log(f'Customized LaunchScreen: {launch_path}')

log('All iOS assets configured.')
