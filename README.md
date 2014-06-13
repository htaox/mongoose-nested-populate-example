### Mongoose Nested Populate Example

Until nested population becomes a feature in Mongoose, this is a viable solution.

Tested with Mongoose v3.8.9

## Gotchas

If the model is defined, but no schema defined, not all nested models will be populated.

Population limited to 1000 documents by default.
If your sub documents are small, this limit should be increased.