/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

ava('.getTypeTriggers() should return a sensible trigger when aggregating events', async (test) => {
	const triggers = jellyscript.getTypeTriggers({
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								$$formula: 'AGGREGATE($events, "data.mentions")'
							}
						}
					}
				}
			}
		}
	})

	test.deepEqual(triggers, [
		{
			type: 'triggered-action@1.0.0',
			version: '1.0.0',
			slug: 'triggered-action-thread-data-mentions',
			requires: [],
			capabilities: [],
			active: true,
			tags: [],
			links: {},
			markers: [],
			data: {
				async: true,
				type: 'thread@1.0.0',
				action: 'action-set-add@1.0.0',
				target: {
					$eval: 'source.links[\'is attached to\'][0].id'
				},
				arguments: {
					property: 'data.mentions',
					value: {
						$if: 'source.data.mentions',
						then: {
							$eval: 'source.data.mentions'
						},
						else: []
					}
				},
				filter: {
					type: 'object',
					$$links: {
						'is attached to': {
							type: 'object',
							required: [ 'type' ],
							properties: {
								type: {
									type: 'string',
									const: 'thread@1.0.0'
								}
							}
						}
					},
					required: [ 'data' ],
					properties: {
						data: {
							type: 'object',
							required: [ 'payload' ],
							properties: {
								payload: {
									type: 'object'
								}
							}
						}
					}
				}
			}
		}
	])
})

ava('.getTypeTriggers() should return a sensible trigger when running DATE_VALUE on events', async (test) => {
	const triggers = jellyscript.getTypeTriggers({
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							event_created_at_dates: {
								type: 'array',
								$$formula: 'DATE_VALUE($events, "created_at")'
							}
						}
					}
				}
			}
		}
	})

	test.deepEqual(triggers, [
		{
			type: 'triggered-action@1.0.0',
			version: '1.0.0',
			slug: 'triggered-action-thread-data-event-created-at-dates',
			requires: [],
			capabilities: [],
			active: true,
			tags: [],
			links: {},
			markers: [],
			data: {
				async: true,
				type: 'thread@1.0.0',
				action: 'action-set-add@1.0.0',
				target: {
					$eval: 'source.links[\'is attached to\'][0].id'
				},
				arguments: {
					property: 'data.event_created_at_dates',
					value: {
						$if: 'source.created_at',
						then: {
							$eval: 'source.created_at'
						},
						else: []
					}
				},
				filter: {
					type: 'object',
					$$links: {
						'is attached to': {
							type: 'object',
							required: [ 'type' ],
							properties: {
								type: {
									type: 'string',
									const: 'thread@1.0.0'
								}
							}
						}
					},
					required: [ 'data' ],
					properties: {
						data: {
							type: 'object',
							required: [ 'payload' ],
							properties: {
								payload: {
									type: 'object'
								}
							}
						}
					}
				}
			}
		}
	])
})

ava('.getTypeTriggers() should still return a sensible trigger when running MAX + DATE_VALUE on events', async (test) => {
	const triggers = jellyscript.getTypeTriggers({
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							latest_event_created_at: {
								type: 'number',
								$$formula: 'MAX(DATE_VALUE($events, "created_at"))'
							}
						}
					}
				}
			}
		}
	})

	test.deepEqual(triggers, [
		{
			type: 'triggered-action@1.0.0',
			version: '1.0.0',
			slug: 'triggered-action-thread-data-latest-event-created-at',
			requires: [],
			capabilities: [],
			active: true,
			tags: [],
			links: {},
			markers: [],
			data: {
				async: true,
				type: 'thread@1.0.0',
				action: 'action-set-add@1.0.0',
				target: {
					$eval: 'source.links[\'is attached to\'][0].id'
				},
				arguments: {
					property: 'data.latest_event_created_at',
					value: {
						$if: 'source.created_at',
						then: {
							$eval: 'source.created_at'
						},
						else: []
					}
				},
				filter: {
					type: 'object',
					$$links: {
						'is attached to': {
							type: 'object',
							required: [ 'type' ],
							properties: {
								type: {
									type: 'string',
									const: 'thread@1.0.0'
								}
							}
						}
					},
					required: [ 'data' ],
					properties: {
						data: {
							type: 'object',
							required: [ 'payload' ],
							properties: {
								payload: {
									type: 'object'
								}
							}
						}
					}
				}
			}
		}
	])
})
