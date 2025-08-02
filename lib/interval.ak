use aiken/interval.{Finite, Interval, between, contains, is_entirely_before}

pub fn is_within_window(
  inter: Interval<Int>,
  tx_interval: Interval<Int>,
) -> Bool {
  let upper_bound_in_range =
    when tx_interval.upper_bound.bound_type is {
      Finite(lock) -> inter |> contains(lock)
      _ -> False
    }

  let lower_bound_in_range =
    when tx_interval.lower_bound.bound_type is {
      Finite(lower) -> inter |> contains(lower)
      _ -> False
    }
  and {
    upper_bound_in_range?,
    lower_bound_in_range?,
  }
}

pub fn is_after_window(inter: Interval<Int>, tx_interval: Interval<Int>) -> Bool {
  when tx_interval.upper_bound.bound_type is {
    Finite(lock) -> inter |> is_entirely_before(lock)
    _ -> False
  }
}

test is_within() {
  let tx_interval = between(9, 10)
  expect is_within_window(between(8, 11), tx_interval)
}

test is_not_within() fail {
  let tx_interval = between(0, 12)
  expect is_within_window(between(8, 11), tx_interval)
}

test is_not_within_weird_value() fail {
  let tx_interval = between(0, 12)
  expect is_within_window(between(8, 0), tx_interval)
}

test lower_bound_is_not_within() fail {
  let tx_interval = between(0, 12)
  expect is_within_window(between(2, 14), tx_interval)
}
