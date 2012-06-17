package org.kvj.sstack;

import org.apache.cordova.api.CordovaInterface;
import org.apache.cordova.api.PluginResult;
import org.apache.cordova.api.PluginResult.Status;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.view.KeyEvent;
import android.view.View;
import android.view.View.OnKeyListener;

import com.phonegap.api.Plugin;

public class KeyboardPlugin extends Plugin {

	private static final String TAG = "KBoard";
	private String cb = null;

	@Override
	public boolean isSynch(String action) {
		return false;
	}

	@Override
	public void setContext(CordovaInterface ctx) {
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
			if (android.os.Build.VERSION.SDK_INT >= 11) {
				obj.put("ctrlKey", event.isCtrlPressed());
				obj.put("shiftKey", event.isShiftPressed());
				obj.put("altKey", event.isAltPressed());
			}
			switch (keyCode) {
			case KeyEvent.KEYCODE_DPAD_UP:
				sendEvent(obj, 38);
				return true;
			case KeyEvent.KEYCODE_DPAD_DOWN:
				sendEvent(obj, 40);
				return true;
			case KeyEvent.KEYCODE_DPAD_LEFT:
				sendEvent(obj, 37);
				return true;
			case KeyEvent.KEYCODE_DPAD_RIGHT:
				sendEvent(obj, 39);
				return true;
			case KeyEvent.KEYCODE_ENTER:
				sendEvent(obj, 13);
				return true;
			case KeyEvent.KEYCODE_MOVE_HOME:
				sendEvent(obj, 36);
				return true;
			case KeyEvent.KEYCODE_MOVE_END:
				sendEvent(obj, 35);
				return true;
			case KeyEvent.KEYCODE_L:
				sendEvent(obj, 76);
				return true;
			case KeyEvent.KEYCODE_S:
				sendEvent(obj, 83);
				return true;
			case KeyEvent.KEYCODE_M:
				sendEvent(obj, 77);
				return true;
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
