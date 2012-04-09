package org.kvj.sstack;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.view.KeyEvent;
import android.view.View;
import android.view.View.OnKeyListener;

import com.phonegap.api.PhonegapActivity;
import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;
import com.phonegap.api.PluginResult.Status;

public class KeyboardPlugin extends Plugin {

	private static final String TAG = "KBoard";
	private String cb = null;

	@Override
	public boolean isSynch(String action) {
		return false;
	}

	@Override
	public void setContext(PhonegapActivity ctx) {
		super.setContext(ctx);
		StickStackActivity activity = (StickStackActivity) ctx;
		activity.getRoot().setOnKeyListener(new OnKeyListener() {

			@Override
			public boolean onKey(View v, int keyCode, KeyEvent event) {
				return keyHandler(keyCode, event);
			}
		});
	}

	private void sendEvent(JSONObject object, int code) throws JSONException {
		object.put("keyCode", code);
		if (null != cb) {
			PluginResult res = new PluginResult(Status.OK, object);
			res.setKeepCallback(true);
			success(res, cb);
		}
	}

	protected boolean keyHandler(int keyCode, KeyEvent event) {
		if (KeyEvent.ACTION_DOWN != event.getAction()) {
			return false;
		}
		// Log.i(TAG, "Key event: " + keyCode + ", " + event.getNumber() + ", "
		// + event.isSymPressed() + ", " + event.isAltPressed() + ", "
		// + event.isShiftPressed() + ", " + event.isCtrlPressed() + ", "
		// + cb);
		JSONObject obj = new JSONObject();
		try {
			obj.put("ctrlKey", event.isCtrlPressed());
			obj.put("shiftKey", event.isShiftPressed());
			obj.put("altKey", event.isAltPressed());
			switch (keyCode) {
			case KeyEvent.KEYCODE_DPAD_UP:
				sendEvent(obj, 38);
				break;
			case KeyEvent.KEYCODE_DPAD_DOWN:
				sendEvent(obj, 40);
				break;
			case KeyEvent.KEYCODE_DPAD_LEFT:
				sendEvent(obj, 37);
				break;
			case KeyEvent.KEYCODE_DPAD_RIGHT:
				sendEvent(obj, 39);
				break;
			case KeyEvent.KEYCODE_ENTER:
				sendEvent(obj, 13);
				break;
			case KeyEvent.KEYCODE_MOVE_HOME:
				sendEvent(obj, 36);
				break;
			case KeyEvent.KEYCODE_MOVE_END:
				sendEvent(obj, 35);
				break;
			}
		} catch (JSONException e) {
			e.printStackTrace();
		}
		return false;
	}

	@Override
	public PluginResult execute(String action, JSONArray params, String cb) {
		if ("subscribe".equals(action)) {
			PluginResult res = new PluginResult(Status.NO_RESULT);
			res.setKeepCallback(true);
			this.cb = cb;
			return res;
		}
		return new PluginResult(Status.INVALID_ACTION);
	}

}