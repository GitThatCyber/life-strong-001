import XCTest
final class FoundationUITests: XCTestCase {
    func testConsecutiveCreationWorkoutRecordingAndRelaunch() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launchEnvironment["LIFE_STRONG_UI_STORE"] = UUID().uuidString
        app.launch()
        XCTAssertTrue(app.buttons["home.createExercise"].waitForExistence(timeout: 15))
        app.buttons["home.createExercise"].tap()
        let name = app.textFields["exercise.name"]
        name.tap(); name.typeText("Rehearsal lunge")
        app.buttons["exercise.save"].tap()
        XCTAssertTrue(app.staticTexts["exercise.saved"].waitForExistence(timeout: 5))
        XCTAssertEqual(name.value as? String, "Name")
        name.typeText("Rehearsal step-up")
        app.buttons["exercise.save"].tap()
        app.buttons["editor.back"].tap()
        XCTAssertTrue(app.staticTexts["Rehearsal lunge"].exists)
        XCTAssertTrue(app.staticTexts["Rehearsal step-up"].exists)
        app.buttons["home.createWorkout"].tap()
        app.textFields["workout.name"].tap(); app.textFields["workout.name"].typeText("Foundation circuit")
        app.buttons["workout.addExercise"].tap()
        app.buttons["choose.Rehearsal lunge"].tap()
        let sets = app.textFields["Target sets"]
        sets.tap(); sets.typeText("3")
        let reps = app.textFields["Target repetitions"]
        reps.tap(); reps.typeText("8")
        app.swipeUp()
        app.buttons["workout.save"].tap()
        XCTAssertTrue(app.staticTexts["Foundation circuit"].waitForExistence(timeout: 5))
        app.staticTexts["Foundation circuit"].tap()
        app.buttons["workout.start"].tap()
        XCTAssertTrue(app.staticTexts["session.targets"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["session.targets"].label.contains("3 sets"))
        let actual = app.textFields["Actual repetitions"]
        actual.tap(); actual.typeText("6")
        app.swipeUp(); app.buttons["session.record"].tap()
        XCTAssertTrue(app.staticTexts["recorded.1"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["recorded.1"].label, "Set 1: 6 reps")
        // Persist a different unfinished form; the next launch must retain both form and record.
        let next = app.textFields["Actual repetitions"]
        next.tap(); next.typeText("9")
        app.terminate(); app.launch()
        XCTAssertTrue(app.buttons["home.createExercise"].waitForExistence(timeout: 15))
        app.swipeUp()
        let session = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "session.")).firstMatch
        XCTAssertTrue(session.waitForExistence(timeout: 5)); session.tap()
        XCTAssertTrue(app.staticTexts["recorded.1"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["Actual repetitions"].value as? String, "9")
        XCTAssertTrue(app.staticTexts["session.targets"].label.contains("8 reps"))
        let recovered = XCTAttachment(screenshot: app.screenshot()); recovered.name = "Recovered local workout"; recovered.lifetime = .keepAlways; add(recovered)
        app.swipeUp()
        app.buttons["session.complete"].tap()
        app.sheets.buttons["Complete workout"].tap()
        app.swipeDown()
        XCTAssertEqual(app.staticTexts["session.status"].label, "Completed")
        let completed = XCTAttachment(screenshot: app.screenshot()); completed.name = "Completed local workout"; completed.lifetime = .keepAlways; add(completed)
    }
    func testReturningToPreviewCanStartAnotherDistinctSession() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launchEnvironment["LIFE_STRONG_UI_STORE"] = UUID().uuidString
        app.launch()
        XCTAssertTrue(app.buttons["home.createExercise"].waitForExistence(timeout: 15))
        app.buttons["home.createExercise"].tap()
        app.textFields["exercise.name"].tap(); app.textFields["exercise.name"].typeText("Repeat lunge")
        app.buttons["exercise.save"].tap(); app.buttons["editor.back"].tap()
        app.buttons["home.createWorkout"].tap()
        app.textFields["workout.name"].tap(); app.textFields["workout.name"].typeText("Repeat workout")
        app.buttons["workout.addExercise"].tap(); app.buttons["choose.Repeat lunge"].tap()
        app.swipeUp(); app.buttons["workout.save"].tap()
        app.staticTexts["Repeat workout"].tap(); app.buttons["workout.start"].tap()
        XCTAssertTrue(app.staticTexts["session.status"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["workout.start"].waitForExistence(timeout: 5))
        app.buttons["workout.start"].tap()
        XCTAssertTrue(app.staticTexts["session.status"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.firstMatch.tap(); app.navigationBars.buttons.firstMatch.tap()
        app.swipeUp()
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "session.")).count, 2)
    }

}
