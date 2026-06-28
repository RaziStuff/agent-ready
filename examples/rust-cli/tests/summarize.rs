#[test]
fn counts_lines() {
    assert_eq!(log_tools::summarize("a\nb"), 2);
}
