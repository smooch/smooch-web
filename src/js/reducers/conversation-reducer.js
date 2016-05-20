import * as ConversationActions from 'actions/conversation-actions';
import { RESET } from 'actions/common-actions';

const INITIAL_STATE = {
    messages: [],
    unreadCount: 0
};

const sortMessages = (messages) => messages.sort((a, b) => {
    // received is undefined when it's the temp message from the user
    if (!a.received && !b.received) {
        // `_tempSent` is a local only prop
        return a._tempSent - b._tempSent;
    }

    if (!a.received) {
        return 1;
    }

    if (!b.received) {
        return -1;
    }

    return a.received - b.received;
});

const addMessage = (messages, message) => {
    const existingMessage = messages.find((m) => isEqual(m, message));

    if (existingMessage) {
        return messages;
    }

    return sortMessages([...messages, message]);
};


const matchMessage = (message, queryProps) => Object.keys(queryProps).every((key) => message[key] === queryProps[key]);

const replaceMessage = (messages, query, newMessage) => {
    const existingMessage = messages.find((message) => matchMessage(message, query));
    if (!existingMessage) {
        return messages;
    }

    const index = messages.indexOf(existingMessage);

    // get rid of duplicate values
    return [...messages.slice(0, index), newMessage, ...messages.slice(index + 1)].reduce((filteredMessages, nextMessage) => {
        const message = filteredMessages.find((m) => isEqual(m, nextMessage));
        if (message) {
            return filteredMessages;
        }
        return [...filteredMessages, nextMessage];
    }, []);
};

const isEqual = (a, b) => {
    if (a._id && b._id && a._id === b._id) {
        return true;
    }

    if (!a._id || !b._id) {
        if (a.role === b.role) {
            if (a.text && b.text && a.text === b.text) {
                return true;
            }

            if (a.mediaType === b.mediaType && a.mediaUrl === b.mediaUrl) {
                return true;
            }
        }
    }

    return false;
};

const mergeMessages = (a, b) => {
    // concat will make a union out of both arrays
    // reduce will return a new array, the function used in the reduction strips out duplicates
    return a.concat(b).reduce((filteredMessages, nextMessage) => {
        const message = filteredMessages.find((m) => isEqual(m, nextMessage));
        if (message) {
            return filteredMessages;
        }
        return [...filteredMessages, nextMessage];
    }, []);
};


export function ConversationReducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case RESET:
        case ConversationActions.RESET_CONVERSATION:
            return Object.assign({}, INITIAL_STATE);
        case ConversationActions.SET_CONVERSATION:
            return Object.assign({}, action.conversation, {
                messages: sortMessages(mergeMessages(state.messages, action.conversation.messages))
            });
        case ConversationActions.ADD_MESSAGE:
            return Object.assign({}, state, {
                messages: addMessage(state.messages, action.message)
            });
        case ConversationActions.REPLACE_MESSAGE:
            return Object.assign({}, state, {
                messages: replaceMessage(state.messages, action.queryProps, action.message)
            });
        case ConversationActions.REMOVE_MESSAGE:
            return Object.assign({}, state, {
                messages: [...state.messages.filter((message) => !matchMessage(message, action.queryProps))]
            });
        case ConversationActions.INCREMENT_UNREAD_COUNT:
            return Object.assign({}, state, {
                unreadCount: state.unreadCount + 1
            });
        case ConversationActions.RESET_UNREAD_COUNT:
            return Object.assign({}, state, {
                unreadCount: 0
            });
        default:
            return state;
    }
}
